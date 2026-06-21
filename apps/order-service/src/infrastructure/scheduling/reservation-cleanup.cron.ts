import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { recordSagaCompensation } from '@jcool/observability';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/ports/order.repository.js';
import {
  CATALOG_CLIENT,
  type CatalogClient,
} from '../../domain/ports/catalog.client.port.js';
import {
  ReconcileOrphanReservationsUseCase,
  type StripePaymentIntentStatusClient,
} from '../../application/use-cases/saga/reconcile-orphan-reservations.use-case.js';
import { STRIPE_PAYMENT_INTENT_STATUS_CLIENT } from '../stripe/stripe-payment-intent-status.adapter.js';

/**
 * Periodic reconciliation that releases inventory for abandoned
 * reservations. Wraps the pure-domain `ReconcileOrphanReservationsUseCase`
 * so the use case stays infrastructure-free and trivially unit-testable.
 *
 * Safety invariant lives in `PrismaOrderRepository.findOrphanReservations` —
 * DO NOT widen the predicate without coordinating compensation in the saga.
 *
 * Concurrency: per-process `busy` guard prevents overlap inside one replica.
 * Cross-replica safety relies on the outbox poller's row-level SKIP LOCKED
 * and use-case-level idempotent release; horizontal scaling will not double
 * release the same reservation.
 */
@Injectable()
export class ReservationCleanupCron {
  private readonly logger = new Logger(ReservationCleanupCron.name);
  private busy = false;
  private readonly useCase: ReconcileOrphanReservationsUseCase;

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(CATALOG_CLIENT) private readonly catalog: CatalogClient,
    @Inject(STRIPE_PAYMENT_INTENT_STATUS_CLIENT)
    private readonly stripeStatus: StripePaymentIntentStatusClient,
  ) {
    this.useCase = new ReconcileOrphanReservationsUseCase({
      orders: this.orders,
      catalog: this.catalog,
      findOrphans: (ms) => this.orders.findOrphanReservations(ms),
      // stale PENDING orders that already have a payment intent get cross-checked
      // against Stripe, so paid-but-stuck orders surface to ops instead of being
      // missed by the orphan predicate above
      findStalePendingWithPiid: (ms) =>
        this.orders.findStalePendingWithPaymentIntent(ms),
      stripeClient: this.stripeStatus,
      olderThanMs: 60 * 60 * 1000, // 1h; override in tests
    });
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runReconciliation(): Promise<void> {
    if (this.busy) {
      // A previous run is still draining — skip silently rather than
      // pile up overlapping queries to Prisma.
      return;
    }
    this.busy = true;
    try {
      const result = await this.useCase.execute();
      if (!result.ok) {
        this.logger.warn(
          `reservation reconciliation aborted: ${result.error.kind}`,
        );
        return;
      }
      const { released, skipped, stalePaymentAlerts } = result.value;
      if (released > 0 || skipped > 0 || stalePaymentAlerts > 0) {
        this.logger.log(
          `reservation reconciliation: released=${released} skipped=${skipped} stalePaymentAlerts=${stalePaymentAlerts}`,
        );
      }
      if (released > 0) {
        // Track compensation source so dashboards distinguish manual /
        // stripe-failure / cron-driven releases. The counter increments
        // once per cycle that did work; raw count of orders released is
        // already logged above.
        recordSagaCompensation('checkout', 'reconciliation_cron');
      }
    } catch (err) {
      // Don't crash the scheduler on a bad cycle — log + retry next tick.
      this.logger.error(
        `reservation reconciliation failed: ${(err as Error).message}`,
      );
    } finally {
      this.busy = false;
    }
  }
}
