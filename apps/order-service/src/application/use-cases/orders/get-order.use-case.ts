import { err, ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import type { Order } from '../../../domain/order.entity.js';
import type { OrderRepository } from '../../../domain/ports/order.repository.js';

export interface GetOrderInput {
  orderId: string;
  requesterId: string;
  requesterRole: 'customer' | 'admin';
}

export class GetOrderUseCase {
  constructor(private readonly orders: OrderRepository) {}

  async execute(input: GetOrderInput): Promise<Result<Order, OrderError>> {
    const order = await this.orders.findById(input.orderId);
    if (!order) return err({ kind: 'ORDER_NOT_FOUND', orderId: input.orderId });
    if (input.requesterRole !== 'admin' && order.userId !== input.requesterId) {
      return err({ kind: 'FORBIDDEN' });
    }
    return ok(order);
  }
}
