import { Cart } from '../../../domain/cart.entity.js';
import { isErr, ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import type { CartRepository } from '../../../domain/ports/cart.repository.js';

export interface MergeGuestCartInput {
  guestSessionKey: string;
  userSessionKey: string;
}

export interface MergeGuestCartResult {
  cart: Cart;
  conflictDropped: boolean;
}

/**
 * Merges a guest cart into the authenticated user's cart on login.
 *
 * Per plan §Risk Assessment: "currency conflict → drop guest cart with
 * warning". The user cart wins; the guest cart is deleted regardless of
 * merge outcome so subsequent logins do not re-merge.
 */
export class MergeGuestCartUseCase {
  constructor(private readonly carts: CartRepository) {}

  async execute(
    input: MergeGuestCartInput,
  ): Promise<Result<MergeGuestCartResult, OrderError>> {
    const guest = await this.carts.findBySessionKey(input.guestSessionKey);
    const userCart =
      (await this.carts.findBySessionKey(input.userSessionKey)) ??
      Cart.empty(input.userSessionKey);

    let conflictDropped = false;
    if (guest && !guest.isEmpty()) {
      const merge = userCart.merge(guest);
      if (isErr(merge)) {
        // Currency conflict — keep user cart untouched, drop guest cart.
        conflictDropped = true;
      }
    }

    await this.carts.save(userCart);
    if (guest) await this.carts.delete(input.guestSessionKey);

    return ok({ cart: userCart, conflictDropped });
  }
}
