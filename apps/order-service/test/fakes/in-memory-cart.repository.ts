import { Cart } from '../../src/domain/cart.entity.js';
import type { CartRepository } from '../../src/domain/ports/cart.repository.js';

export class InMemoryCartRepository implements CartRepository {
  private store = new Map<string, Cart>();

  async findBySessionKey(sessionKey: string): Promise<Cart | null> {
    const cart = this.store.get(sessionKey);
    if (!cart) return null;
    // Deep clone so callers can mutate freely without surprising other tests.
    return Cart.rehydrate(cart.sessionKey, cart.snapshotItems(), cart.currency);
  }

  async save(cart: Cart): Promise<void> {
    this.store.set(
      cart.sessionKey,
      Cart.rehydrate(cart.sessionKey, cart.snapshotItems(), cart.currency),
    );
  }

  async delete(sessionKey: string): Promise<void> {
    this.store.delete(sessionKey);
  }
}
