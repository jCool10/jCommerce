import { Cart } from '../../../domain/cart.entity.js';
import { err, isErr, ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import type { CartRepository } from '../../../domain/ports/cart.repository.js';

export interface RemoveFromCartInput {
  sessionKey: string;
  skuId: string;
}

export class RemoveFromCartUseCase {
  constructor(private readonly carts: CartRepository) {}

  async execute(input: RemoveFromCartInput): Promise<Result<Cart, OrderError>> {
    const cart = await this.carts.findBySessionKey(input.sessionKey);
    if (!cart) return err({ kind: 'CART_NOT_FOUND', sessionKey: input.sessionKey });

    const removed = cart.removeItem(input.skuId);
    if (isErr(removed)) return removed;

    await this.carts.save(cart);
    return ok(cart);
  }
}
