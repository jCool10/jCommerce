import { err, isErr, ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import { orderCancelledEvents } from '../../../domain/events/order-events.js';
import type { Order } from '../../../domain/order.entity.js';
import type { CatalogClient } from '../../../domain/ports/catalog.client.port.js';
import type { OrderRepository } from '../../../domain/ports/order.repository.js';

export interface MarkPaymentFailedInput {
  orderId: string;
  reason: string;
}

/**
 * Triggered by RabbitMQ consumer subscribed to `payment.failed`.
 * Compensation: release reservations + cancel order + emit `order.cancelled`.
 *
 * Idempotency: a replay for an already-CANCELLED order is a no-op so the
 * catalog isn't double-released. Inventory release itself is idempotent
 * on the catalog side (reservations row keyed on orderId), but skipping
 * the network call here avoids the spurious 409/200 churn.
 */
export class MarkPaymentFailedUseCase {
  constructor(
    private readonly orders: OrderRepository,
    private readonly catalog: CatalogClient,
  ) {}

  async execute(input: MarkPaymentFailedInput): Promise<Result<Order, OrderError>> {
    return this.orders.withAdvisoryLock(input.orderId, async () => {
      const order = await this.orders.findById(input.orderId);
      if (!order) return err({ kind: 'ORDER_NOT_FOUND', orderId: input.orderId });

      // Idempotency: already cancelled — no-op.
      if (order.status === 'CANCELLED') return ok(order);

      // Release first so a save-failure does not strand inventory. Release is
      // safe to retry (catalog's release endpoint is idempotent per orderId).
      const release = await this.catalog.releaseInventory(input.orderId);
      if (isErr(release)) return release;

      const cancel = order.cancel('PAYMENT_FAILED');
      if (isErr(cancel)) return cancel;

      const events = orderCancelledEvents(order, 'PAYMENT_FAILED');
      await this.orders.save(order, [events.outbox], [events.audit]);
      return ok(order);
    });
  }
}
