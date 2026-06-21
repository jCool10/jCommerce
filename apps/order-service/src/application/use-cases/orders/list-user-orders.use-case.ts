import { ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import type {
  OrderListPage,
  OrderRepository,
} from '../../../domain/ports/order.repository.js';

export interface ListUserOrdersInput {
  userId: string;
  cursor: string | null;
  limit: number;
}

export class ListUserOrdersUseCase {
  constructor(private readonly orders: OrderRepository) {}

  async execute(input: ListUserOrdersInput): Promise<Result<OrderListPage, OrderError>> {
    const page = await this.orders.list(
      { userId: input.userId },
      { cursor: input.cursor, limit: Math.min(Math.max(input.limit, 1), 100) },
    );
    return ok(page);
  }
}
