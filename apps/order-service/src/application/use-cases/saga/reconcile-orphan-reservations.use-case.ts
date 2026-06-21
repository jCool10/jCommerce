import { Logger } from '@nestjs/common';
import { ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import type { CatalogClient } from '../../../domain/ports/catalog.client.port.js';
import type { OrderRepository } from '../../../domain/ports/order.repository.js';

/**
 * Releases inventory for orphaned reservations. Only touch orders that are
 * CANCELLED, or PENDING with no payment intent and older than 1h. Do NOT widen
 * this to PAYMENT_PENDING — that races in-flight Stripe checkouts and would
 * release stock out from under a paying customer.
 */
export interface OrphanCandidate {
  orderId: string;
  status: 'PENDING' | 'CANCELLED';
}

/**
 * Narrow slice of data needed for Stripe PI lookup during stale-paid reconciliation.
 * Does NOT auto-confirm — only surfaces the discrepancy so ops can act.
 */
export interface StalePaymentIntentCandidate {
  orderId: string;
  stripePaymentIntentId: string;
}

/**
 * Narrow port: retrieve a Stripe PaymentIntent's status without pulling in
 * the full Stripe SDK type into application layer. The infrastructure adapter
 * implements this via stripe.paymentIntents.retrieve().
 */
export interface StripePaymentIntentStatusClient {
  retrieve(piid: string): Promise<{ id: string; status: string }>;
}

export interface ReconcileOrphanReservationsDeps {
  orders: OrderRepository;
  catalog: CatalogClient;
  findOrphans: (olderThanMs: number) => Promise<OrphanCandidate[]>;
  /**
   * Returns PENDING orders that HAVE a stripePaymentIntentId and whose
   * updatedAt is older than stalePiidThresholdMs. These are candidates for
   * the "paid-but-not-confirmed" surface check (I2 reconciliation path).
   */
  findStalePendingWithPiid?: (olderThanMs: number) => Promise<StalePaymentIntentCandidate[]>;
  /** Stripe client for looking up PI status on stale PENDING+piid orders. */
  stripeClient?: StripePaymentIntentStatusClient;
  olderThanMs?: number;
  /** Threshold for stale PENDING-with-piid orders, defaults to 15 min. */
  stalePiidThresholdMs?: number;
}

export interface ReconcileResult {
  released: number;
  skipped: number;
  /** Orders surfaced as paid-but-not-confirmed for ops visibility. */
  stalePaymentAlerts: number;
}

export class ReconcileOrphanReservationsUseCase {
  private readonly logger = new Logger(ReconcileOrphanReservationsUseCase.name);
  private readonly orders: OrderRepository;
  private readonly catalog: CatalogClient;
  private readonly findOrphans: (olderThanMs: number) => Promise<OrphanCandidate[]>;
  private readonly findStalePendingWithPiid?: (olderThanMs: number) => Promise<StalePaymentIntentCandidate[]>;
  private readonly stripeClient?: StripePaymentIntentStatusClient;
  private readonly olderThanMs: number;
  private readonly stalePiidThresholdMs: number;

  constructor(deps: ReconcileOrphanReservationsDeps) {
    this.orders = deps.orders;
    this.catalog = deps.catalog;
    this.findOrphans = deps.findOrphans;
    this.findStalePendingWithPiid = deps.findStalePendingWithPiid;
    this.stripeClient = deps.stripeClient;
    this.olderThanMs = deps.olderThanMs ?? 60 * 60 * 1000;
    this.stalePiidThresholdMs = deps.stalePiidThresholdMs ?? 15 * 60 * 1000;
  }

  async execute(): Promise<Result<ReconcileResult, OrderError>> {
    const candidates = await this.findOrphans(this.olderThanMs);
    let released = 0;
    let skipped = 0;

    for (const c of candidates) {
      const release = await this.catalog.releaseInventory(c.orderId);
      if (release.ok) released += 1;
      else skipped += 1;
    }

    // I2: Surface stale PENDING orders that already have a Stripe PI.
    // These are "paid-but-no-order" candidates — we do NOT auto-confirm;
    // we emit alert logs + count them so ops dashboards pick them up.
    const stalePaymentAlerts = await this.reconcileStalePaidOrders();

    return ok({ released, skipped, stalePaymentAlerts });
  }

  /**
   * Scans PENDING orders with a piid whose updatedAt exceeded the stale
   * threshold. For each, retrieves the Stripe PI status:
   *   - If succeeded → log ERROR + emit a structured alert so ops can
   *     manually trigger re-delivery or directly invoke MarkPaymentSucceeded.
   *   - Other statuses → log at debug level; not actionable yet.
   *
   * Returns the count of confirmed-paid-but-still-PENDING orders found.
   */
  private async reconcileStalePaidOrders(): Promise<number> {
    if (!this.findStalePendingWithPiid || !this.stripeClient) return 0;

    let alertCount = 0;
    let candidates: StalePaymentIntentCandidate[];
    try {
      candidates = await this.findStalePendingWithPiid(this.stalePiidThresholdMs);
    } catch (err) {
      this.logger.warn(`stale-paid scan failed to fetch candidates: ${(err as Error).message}`);
      return 0;
    }

    for (const c of candidates) {
      try {
        const pi = await this.stripeClient.retrieve(c.stripePaymentIntentId);
        if (pi.status === 'succeeded') {
          // Stripe has charged but the order is still PENDING — ops must intervene.
          // We log at ERROR level so alerting rules catch this on the first scan.
          this.logger.error(
            `payment.reconcile_required orderId=${c.orderId} piid=${c.stripePaymentIntentId} ` +
              `stripeStatus=succeeded orderStatus=PENDING — manual re-delivery or MarkPaymentSucceeded required`,
          );
          alertCount += 1;
        } else {
          this.logger.debug(
            `stale-pending orderId=${c.orderId} piid=${c.stripePaymentIntentId} stripeStatus=${pi.status}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `stripe retrieve failed for piid=${c.stripePaymentIntentId}: ${(err as Error).message}`,
        );
      }
    }

    return alertCount;
  }
}
