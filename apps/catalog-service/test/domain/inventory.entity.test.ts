import { describe, expect, it } from 'vitest';
import { Inventory } from '../../src/domain/inventory.entity.js';
import { isErr, isOk } from '../../src/domain/common/result.js';

const SKU = '00000000-0000-0000-0000-000000000001';

describe('Inventory.reserve()', () => {
  it('decrements available and increments reserved when stock sufficient', () => {
    const inv = Inventory.rehydrate({ skuId: SKU, available: 10, reserved: 2 });

    const result = inv.reserve(3);

    expect(isOk(result)).toBe(true);
    expect(inv.available).toBe(7);
    expect(inv.reserved).toBe(5);
  });

  it('returns INSUFFICIENT_STOCK without mutating when requested > available', () => {
    const inv = Inventory.rehydrate({ skuId: SKU, available: 2, reserved: 0 });

    const result = inv.reserve(3);

    expect(isErr(result)).toBe(true);
    if (isErr(result) && result.error.kind === 'INSUFFICIENT_STOCK') {
      expect(result.error.skuId).toBe(SKU);
      expect(result.error.requested).toBe(3);
      expect(result.error.available).toBe(2);
    } else {
      throw new Error('expected INSUFFICIENT_STOCK error');
    }
    expect(inv.available).toBe(2);
    expect(inv.reserved).toBe(0);
  });

  it('rejects non-positive quantities', () => {
    const inv = Inventory.rehydrate({ skuId: SKU, available: 10, reserved: 0 });

    const zero = inv.reserve(0);
    const neg = inv.reserve(-1);

    expect(isErr(zero)).toBe(true);
    expect(isErr(neg)).toBe(true);
    if (isErr(zero)) expect(zero.error.kind).toBe('INVALID_QUANTITY');
    if (isErr(neg)) expect(neg.error.kind).toBe('INVALID_QUANTITY');
  });

  it('allows reserving exactly available stock', () => {
    const inv = Inventory.rehydrate({ skuId: SKU, available: 5, reserved: 0 });

    const result = inv.reserve(5);

    expect(isOk(result)).toBe(true);
    expect(inv.available).toBe(0);
    expect(inv.reserved).toBe(5);
  });
});

describe('Inventory.release()', () => {
  it('increments available and decrements reserved', () => {
    const inv = Inventory.rehydrate({ skuId: SKU, available: 5, reserved: 3 });

    const result = inv.release(2);

    expect(isOk(result)).toBe(true);
    expect(inv.available).toBe(7);
    expect(inv.reserved).toBe(1);
  });

  it('rejects releasing more than currently reserved (programming error)', () => {
    const inv = Inventory.rehydrate({ skuId: SKU, available: 5, reserved: 1 });

    const result = inv.release(2);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('OVER_RELEASE');
    expect(inv.available).toBe(5);
    expect(inv.reserved).toBe(1);
  });
});

describe('Inventory.restock()', () => {
  it('adds to available stock', () => {
    const inv = Inventory.rehydrate({ skuId: SKU, available: 5, reserved: 1 });

    inv.restock(10);

    expect(inv.available).toBe(15);
    expect(inv.reserved).toBe(1);
  });
});
