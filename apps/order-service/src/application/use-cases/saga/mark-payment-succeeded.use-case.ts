import { recordOrderCreated, recordRevenue } from '@jcool/observability';
import { err, isErr, ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import { orderConfirmedEvents } from '../../../domain/events/order-events.js';
import type { Order } from '../../../domain/order.entity.js';
import type { OrderRepository } from '../../../domain/ports/order.repository.js';

export interface MarkPaymentSucceededInput {
  orderId: string;
  stripePaymentIntentId: string;
}

/**
 * Triggered by RabbitMQ consumer subscribed to `payment.succeeded`.
 * Phase 8 adds a Stripe webhook controller that publishes the same event.
 *
 * Idempotency: replaying a payment.succeeded for an already-CONFIRMED order
 * returns ok(order) without re-emitting events. This is critical because
 * RabbitMQ can redeliver and webhooks can replay.
 */
export class MarkPaymentSucceededUseCase {
  constructor(private readonly orders: OrderRepository) {}

  async execute(
    input: MarkPaymentSucceededInput,
  ): Promise<Result<Order, OrderError>> {
    return this.orders.withAdvisoryLock(input.orderId, async () => {
      const order = await this.orders.findById(input.orderId);
      if (!order) return err({ kind: 'ORDER_NOT_FOUND', orderId: input.orderId });

      // Defense: the event must match the intent we created.
      if (order.stripePaymentIntentId !== input.stripePaymentIntentId) {
        return err({
          kind: 'PAYMENT_INTENT_MISMATCH',
          expected: order.stripePaymentIntentId ?? '',
          got: input.stripePaymentIntentId,
        });
      }

      // Idempotency: already CONFIRMED — no-op.
      if (order.status === 'CONFIRMED' || order.status === 'SHIPPED' || order.status === 'DELIVERED') {
        return ok(order);
      }

      const confirm = order.confirm();
      if (isErr(confirm)) return confirm;

      const events = orderConfirmedEvents(order);
      await this.orders.save(order, [events.outbox], [events.audit]);
      // Recognise revenue + bump the orders counter only after the payment
      // confirmation is durable. The saga's PENDING-time call would have
      // counted unconfirmed checkouts (3DS rejection / abandoned flow).
      recordOrderCreated('confirmed', order.currency);
      recordRevenue(order.currency, order.totalAmount);
      return ok(order);
    });
  }
}
