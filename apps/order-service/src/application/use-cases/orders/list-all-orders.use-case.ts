import type { OrderStatus } from '@jcool/contracts';
import { ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import type {
  OrderListPage,
  OrderRepository,
} from '../../../domain/ports/order.repository.js';

export interface ListAllOrdersInput {
  cursor: string | null;
  limit: number;
  status?: OrderStatus;
}

export class ListAllOrdersUseCase {
  constructor(private readonly orders: OrderRepository) {}

  async execute(input: ListAllOrdersInput): Promise<Result<OrderListPage, OrderError>> {
    const page = await this.orders.list(
      { status: input.status },
      { cursor: input.cursor, limit: Math.min(Math.max(input.limit, 1), 100) },
    );
    return ok(page);
  }
}
