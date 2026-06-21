import type { Cart } from '../cart.entity.js';

/**
 * Cart persistence (Redis hash on `cart:{sessionKey}`).
 *
 * Carts have a TTL (default 7d) — repository refreshes it on every save.
 * `sessionKey` is either `guest:{anonUUID}` (set as httpOnly cookie by the
 * storefront on first visit) or `user:{userId}` (after auth).
 */
export interface CartRepository {
  findBySessionKey(sessionKey: string): Promise<Cart | null>;
  save(cart: Cart): Promise<void>;
  delete(sessionKey: string): Promise<void>;
}

export const CART_REPOSITORY = Symbol('CART_REPOSITORY');
