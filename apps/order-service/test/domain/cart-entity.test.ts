import { describe, expect, it } from 'vitest';
import { Cart } from '../../src/domain/cart.entity.js';
import { isErr, isOk } from '../../src/domain/common/result.js';

const SESSION = 'guest:abc';
const USER_SESSION = 'user:42';
const SKU_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
const SKU_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
const PROD_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PROD_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('Cart.empty', () => {
  it('starts with no currency lock and no items', () => {
    const cart = Cart.empty(SESSION);
    expect(cart.sessionKey).toBe(SESSION);
    expect(cart.currency).toBeNull();
    expect(cart.items).toHaveLength(0);
    expect(cart.isEmpty()).toBe(true);
  });
});

describe('Cart.addItem currency lock', () => {
  it('locks currency to the first item added', () => {
    const cart = Cart.empty(SESSION);
    const r = cart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 1, currency: 'USD' });
    expect(isOk(r)).toBe(true);
    expect(cart.currency).toBe('USD');
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]!.quantity).toBe(1);
  });

  it('rejects a second item with a different currency', () => {
    const cart = Cart.empty(SESSION);
    cart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 1, currency: 'USD' });
    const r = cart.addItem({ skuId: SKU_B, productId: PROD_B, quantity: 2, currency: 'VND' });
    expect(isErr(r)).toBe(true);
    if (isErr(r) && r.error.kind === 'CART_CURRENCY_LOCKED') {
      expect(r.error.locked).toBe('USD');
      expect(r.error.attempted).toBe('VND');
    }
    // Currency lock unchanged + VND item rejected.
    expect(cart.currency).toBe('USD');
    expect(cart.items).toHaveLength(1);
  });

  it('coalesces adds for the same skuId by summing quantity', () => {
    const cart = Cart.empty(SESSION);
    cart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 1, currency: 'USD' });
    cart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 3, currency: 'USD' });
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]!.quantity).toBe(4);
  });

  it('rejects non-positive quantity', () => {
    const cart = Cart.empty(SESSION);
    const r = cart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 0, currency: 'USD' });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('INVALID_QUANTITY');
  });
});

describe('Cart.updateQuantity', () => {
  it('replaces quantity for an existing item', () => {
    const cart = Cart.empty(SESSION);
    cart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 1, currency: 'USD' });
    const r = cart.updateQuantity(SKU_A, 5);
    expect(isOk(r)).toBe(true);
    expect(cart.items[0]!.quantity).toBe(5);
  });

  it('fails if skuId not in cart', () => {
    const cart = Cart.empty(SESSION);
    const r = cart.updateQuantity(SKU_A, 2);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('CART_ITEM_NOT_FOUND');
  });

  it('removes the item when quantity goes to 0', () => {
    const cart = Cart.empty(SESSION);
    cart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 2, currency: 'USD' });
    cart.addItem({ skuId: SKU_B, productId: PROD_B, quantity: 1, currency: 'USD' });
    cart.updateQuantity(SKU_A, 0);
    expect(cart.items.map((i) => i.skuId)).toEqual([SKU_B]);
  });
});

describe('Cart.removeItem + clear', () => {
  it('removes a single skuId', () => {
    const cart = Cart.empty(SESSION);
    cart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 1, currency: 'USD' });
    cart.addItem({ skuId: SKU_B, productId: PROD_B, quantity: 2, currency: 'USD' });
    const r = cart.removeItem(SKU_A);
    expect(isOk(r)).toBe(true);
    expect(cart.items.map((i) => i.skuId)).toEqual([SKU_B]);
  });

  it('clear() empties the cart AND releases the currency lock', () => {
    const cart = Cart.empty(SESSION);
    cart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 1, currency: 'USD' });
    cart.clear();
    expect(cart.isEmpty()).toBe(true);
    expect(cart.currency).toBeNull();
  });
});

describe('Cart.merge (guest → user on login)', () => {
  it('merges a same-currency guest cart into the user cart, summing quantities', () => {
    const userCart = Cart.empty(USER_SESSION);
    userCart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 1, currency: 'USD' });
    const guestCart = Cart.empty(SESSION);
    guestCart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 2, currency: 'USD' });
    guestCart.addItem({ skuId: SKU_B, productId: PROD_B, quantity: 3, currency: 'USD' });

    const r = userCart.merge(guestCart);
    expect(isOk(r)).toBe(true);
    expect(userCart.items).toHaveLength(2);
    expect(userCart.items.find((i) => i.skuId === SKU_A)?.quantity).toBe(3);
    expect(userCart.items.find((i) => i.skuId === SKU_B)?.quantity).toBe(3);
  });

  it('rejects merge when currencies conflict — user cart wins, guest cart NOT merged', () => {
    const userCart = Cart.empty(USER_SESSION);
    userCart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 1, currency: 'USD' });
    const guestCart = Cart.empty(SESSION);
    guestCart.addItem({ skuId: SKU_B, productId: PROD_B, quantity: 1, currency: 'VND' });

    const r = userCart.merge(guestCart);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('CART_CURRENCY_LOCKED');
    // User cart unchanged.
    expect(userCart.items).toHaveLength(1);
    expect(userCart.currency).toBe('USD');
  });

  it('an empty user cart adopts the guest cart currency on merge', () => {
    const userCart = Cart.empty(USER_SESSION);
    const guestCart = Cart.empty(SESSION);
    guestCart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 2, currency: 'VND' });

    const r = userCart.merge(guestCart);
    expect(isOk(r)).toBe(true);
    expect(userCart.currency).toBe('VND');
    expect(userCart.items).toHaveLength(1);
  });
});

describe('Cart.snapshotItems (for checkout)', () => {
  it('returns plain { skuId, quantity } rows', () => {
    const cart = Cart.empty(SESSION);
    cart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 2, currency: 'USD' });
    cart.addItem({ skuId: SKU_B, productId: PROD_B, quantity: 5, currency: 'USD' });
    const snapshot = cart.snapshotItems();
    expect(snapshot).toEqual([
      { skuId: SKU_A, productId: PROD_A, quantity: 2 },
      { skuId: SKU_B, productId: PROD_B, quantity: 5 },
    ]);
  });
});
