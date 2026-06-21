import type { OrderStatus } from '@jcool/contracts';
import { err, isErr, ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import {
  orderDeliveredAudit,
  orderShippedEvents,
} from '../../../domain/events/order-events.js';
import type { Order } from '../../../domain/order.entity.js';
import type { OrderRepository } from '../../../domain/ports/order.repository.js';

export interface UpdateOrderStatusInput {
  orderId: string;
  to: Extract<OrderStatus, 'SHIPPED' | 'DELIVERED'>;
}

export class UpdateOrderStatusUseCase {
  constructor(private readonly orders: OrderRepository) {}

  /**
   * Admin-only forward-motion transition for fulfilment.
   * Cancellation is owned by the saga (`MarkPaymentFailedUseCase`) or a
   * dedicated future use case — not this endpoint.
   */
  async execute(input: UpdateOrderStatusInput): Promise<Result<Order, OrderError>> {
    return this.orders.withAdvisoryLock(input.orderId, async () => {
      const order = await this.orders.findById(input.orderId);
      if (!order) return err({ kind: 'ORDER_NOT_FOUND', orderId: input.orderId });

      const transition =
        input.to === 'SHIPPED' ? order.markShipped() : order.markDelivered();
      if (isErr(transition)) return transition;

      if (input.to === 'SHIPPED') {
        const events = orderShippedEvents(order);
        await this.orders.save(order, [events.outbox], [events.audit]);
      } else {
        await this.orders.save(order, [], [orderDeliveredAudit(order)]);
      }
      return ok(order);
    });
  }
}
