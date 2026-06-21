import type { Currency } from '@jcool/contracts';
import { err, ok, type Result } from './common/result.js';
import type { OrderError } from './order-error.js';

export interface CartLine {
  skuId: string;
  productId: string;
  quantity: number;
}

export interface AddCartItemInput {
  skuId: string;
  productId: string;
  quantity: number;
  currency: Currency;
}

/**
 * In-memory cart aggregate. Persisted via CartRepository (Redis hash) keyed
 * on a `sessionKey` (either `guest:{anonUUID}` or `user:{userId}`).
 *
 * Invariant — Currency Lock: once a cart contains at least one item, every
 * subsequent add MUST match the locked currency. clear() releases the lock
 * so a new currency can be chosen. merge() on currency-conflict refuses and
 * leaves both carts untouched (controller logs + warns the user).
 */
export class Cart {
  private constructor(
    private readonly _sessionKey: string,
    private _items: CartLine[],
    private _currency: Currency | null,
  ) {}

  get sessionKey(): string {
    return this._sessionKey;
  }
  get currency(): Currency | null {
    return this._currency;
  }
  get items(): CartLine[] {
    return this._items.map((i) => ({ ...i }));
  }

  static empty(sessionKey: string): Cart {
    return new Cart(sessionKey, [], null);
  }

  static rehydrate(
    sessionKey: string,
    items: CartLine[],
    currency: Currency | null,
  ): Cart {
    return new Cart(sessionKey, items.map((i) => ({ ...i })), currency);
  }

  isEmpty(): boolean {
    return this._items.length === 0;
  }

  // ─── mutations ─────────────────────────────────────────────────────
  addItem(input: AddCartItemInput): Result<void, OrderError> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      return err({ kind: 'INVALID_QUANTITY', reason: 'NON_POSITIVE' });
    }
    if (this._currency !== null && this._currency !== input.currency) {
      return err({
        kind: 'CART_CURRENCY_LOCKED',
        locked: this._currency,
        attempted: input.currency,
      });
    }
    if (this._currency === null) {
      this._currency = input.currency;
    }
    const existing = this._items.find((i) => i.skuId === input.skuId);
    if (existing) {
      existing.quantity += input.quantity;
    } else {
      this._items.push({
        skuId: input.skuId,
        productId: input.productId,
        quantity: input.quantity,
      });
    }
    return ok(undefined);
  }

  updateQuantity(skuId: string, quantity: number): Result<void, OrderError> {
    if (!Number.isInteger(quantity) || quantity < 0) {
      return err({ kind: 'INVALID_QUANTITY', reason: 'NON_POSITIVE' });
    }
    const idx = this._items.findIndex((i) => i.skuId === skuId);
    if (idx === -1) return err({ kind: 'CART_ITEM_NOT_FOUND', skuId });
    if (quantity === 0) {
      this._items.splice(idx, 1);
    } else {
      this._items[idx]!.quantity = quantity;
    }
    if (this._items.length === 0) this._currency = null;
    return ok(undefined);
  }

  removeItem(skuId: string): Result<void, OrderError> {
    const idx = this._items.findIndex((i) => i.skuId === skuId);
    if (idx === -1) return err({ kind: 'CART_ITEM_NOT_FOUND', skuId });
    this._items.splice(idx, 1);
    if (this._items.length === 0) this._currency = null;
    return ok(undefined);
  }

  clear(): void {
    this._items = [];
    this._currency = null;
  }

  /**
   * Merge `other` into THIS cart. On currency conflict the merge is refused
   * and both carts stay untouched (caller surfaces a UX warning + clears
   * the guest cart out-of-band).
   */
  merge(other: Cart): Result<void, OrderError> {
    if (other.isEmpty()) return ok(undefined);

    // Both non-empty + currencies disagree → conflict.
    if (
      this._currency !== null &&
      other._currency !== null &&
      this._currency !== other._currency
    ) {
      return err({
        kind: 'CART_CURRENCY_LOCKED',
        locked: this._currency,
        attempted: other._currency,
      });
    }

    if (this._currency === null) this._currency = other._currency;

    for (const incoming of other._items) {
      const existing = this._items.find((i) => i.skuId === incoming.skuId);
      if (existing) {
        existing.quantity += incoming.quantity;
      } else {
        this._items.push({ ...incoming });
      }
    }
    return ok(undefined);
  }

  snapshotItems(): CartLine[] {
    return this._items.map((i) => ({ ...i }));
  }
}
