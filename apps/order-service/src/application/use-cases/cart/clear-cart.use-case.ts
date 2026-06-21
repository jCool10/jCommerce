import type { Result } from '../../../domain/common/result.js';
import { ok } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import type { CartRepository } from '../../../domain/ports/cart.repository.js';

export interface ClearCartInput {
  sessionKey: string;
}

export class ClearCartUseCase {
  constructor(private readonly carts: CartRepository) {}

  async execute(input: ClearCartInput): Promise<Result<void, OrderError>> {
    await this.carts.delete(input.sessionKey);
    return ok(undefined);
  }
}
