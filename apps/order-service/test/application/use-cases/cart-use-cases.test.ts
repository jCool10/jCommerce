import { beforeEach, describe, expect, it } from 'vitest';
import { AddToCartUseCase } from '../../../src/application/use-cases/cart/add-to-cart.use-case.js';
import { RemoveFromCartUseCase } from '../../../src/application/use-cases/cart/remove-from-cart.use-case.js';
import { UpdateCartQuantityUseCase } from '../../../src/application/use-cases/cart/update-cart-quantity.use-case.js';
import { ClearCartUseCase } from '../../../src/application/use-cases/cart/clear-cart.use-case.js';
import { GetCartUseCase } from '../../../src/application/use-cases/cart/get-cart.use-case.js';
import { MergeGuestCartUseCase } from '../../../src/application/use-cases/cart/merge-guest-cart.use-case.js';
import { isErr, isOk } from '../../../src/domain/common/result.js';
import { InMemoryCartRepository } from '../../fakes/in-memory-cart.repository.js';
import { FakeCatalogClient } from '../../fakes/fake-catalog.client.js';

const GUEST = 'guest:abc';
const USER = 'user:42';
const SKU_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
const SKU_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
const PROD_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PROD_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const makeCatalog = () =>
  new FakeCatalogClient()
    .seedSku({
      skuId: SKU_A,
      productId: 'p-a',
      productName: 'Widget',
      prices: { USD: 1500, VND: 350000 },
      available: 10,
    })
    .seedSku({
      skuId: SKU_B,
      productId: 'p-b',
      productName: 'Gizmo',
      prices: { USD: 4000, VND: 950000 },
      available: 3,
    });

describe('AddToCartUseCase', () => {
  let carts: InMemoryCartRepository;
  let catalog: FakeCatalogClient;
  let sut: AddToCartUseCase;

  beforeEach(() => {
    carts = new InMemoryCartRepository();
    catalog = makeCatalog();
    sut = new AddToCartUseCase(carts, catalog);
  });

  it('creates a cart when none exists and adds the item', async () => {
    const r = await sut.execute({
      sessionKey: GUEST,
      skuId: SKU_A,
      productId: PROD_A,
      quantity: 2,
      currency: 'USD',
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.currency).toBe('USD');
      expect(r.value.items).toHaveLength(1);
    }
  });

  it('rejects when stock available < requested quantity', async () => {
    const r = await sut.execute({
      sessionKey: GUEST,
      skuId: SKU_B,
      productId: PROD_B,
      quantity: 10,
      currency: 'USD',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('INSUFFICIENT_STOCK');
  });

  it('rejects when SKU has no price in the requested currency', async () => {
    catalog.seedSku({
      skuId: SKU_A,
      productId: 'p-a',
      productName: 'Widget',
      prices: { USD: 1500 }, // VND missing
      available: 10,
    });
    const r = await sut.execute({
      sessionKey: GUEST,
      skuId: SKU_A,
      productId: PROD_A,
      quantity: 1,
      currency: 'VND',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('SKU_PRICE_MISSING');
  });

  it('rejects a second item with mismatched currency (currency lock)', async () => {
    await sut.execute({ sessionKey: GUEST, skuId: SKU_A, productId: PROD_A, quantity: 1, currency: 'USD' });
    const r = await sut.execute({
      sessionKey: GUEST,
      skuId: SKU_B,
      productId: PROD_B,
      quantity: 1,
      currency: 'VND',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('CART_CURRENCY_LOCKED');
  });
});

describe('RemoveFromCartUseCase', () => {
  it('removes an existing item', async () => {
    const carts = new InMemoryCartRepository();
    const catalog = makeCatalog();
    await new AddToCartUseCase(carts, catalog).execute({
      sessionKey: GUEST,
      skuId: SKU_A,
      productId: PROD_A,
      quantity: 1,
      currency: 'USD',
    });

    const r = await new RemoveFromCartUseCase(carts).execute({
      sessionKey: GUEST,
      skuId: SKU_A,
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.items).toHaveLength(0);
  });

  it('fails when cart does not exist', async () => {
    const carts = new InMemoryCartRepository();
    const r = await new RemoveFromCartUseCase(carts).execute({
      sessionKey: GUEST,
      skuId: SKU_A,
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('CART_NOT_FOUND');
  });
});

describe('UpdateCartQuantityUseCase', () => {
  it('updates quantity within stock', async () => {
    const carts = new InMemoryCartRepository();
    const catalog = makeCatalog();
    await new AddToCartUseCase(carts, catalog).execute({
      sessionKey: GUEST,
      skuId: SKU_A,
      productId: PROD_A,
      quantity: 1,
      currency: 'USD',
    });

    const r = await new UpdateCartQuantityUseCase(carts, catalog).execute({
      sessionKey: GUEST,
      skuId: SKU_A,
      quantity: 5,
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.items[0]!.quantity).toBe(5);
  });

  it('rejects increase beyond available stock', async () => {
    const carts = new InMemoryCartRepository();
    const catalog = makeCatalog();
    await new AddToCartUseCase(carts, catalog).execute({
      sessionKey: GUEST,
      skuId: SKU_B,
      productId: PROD_B,
      quantity: 1,
      currency: 'USD',
    });
    const r = await new UpdateCartQuantityUseCase(carts, catalog).execute({
      sessionKey: GUEST,
      skuId: SKU_B,
      quantity: 10,
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('INSUFFICIENT_STOCK');
  });
});

describe('ClearCartUseCase', () => {
  it('deletes the cart key (idempotent on missing)', async () => {
    const carts = new InMemoryCartRepository();
    await new ClearCartUseCase(carts).execute({ sessionKey: GUEST });
    expect(await carts.findBySessionKey(GUEST)).toBeNull();
  });
});

describe('GetCartUseCase', () => {
  it('returns empty cart shape when no cart exists', async () => {
    const carts = new InMemoryCartRepository();
    const r = await new GetCartUseCase(carts, makeCatalog()).execute({
      sessionKey: GUEST,
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.items).toEqual([]);
      expect(r.value.subtotalAmount).toBe(0);
      expect(r.value.currency).toBeNull();
    }
  });

  it('hydrates items with catalog prices and computes subtotal', async () => {
    const carts = new InMemoryCartRepository();
    const catalog = makeCatalog();
    const add = new AddToCartUseCase(carts, catalog);
    await add.execute({ sessionKey: GUEST, skuId: SKU_A, productId: PROD_A, quantity: 2, currency: 'USD' });
    await add.execute({ sessionKey: GUEST, skuId: SKU_B, productId: PROD_B, quantity: 1, currency: 'USD' });

    const r = await new GetCartUseCase(carts, catalog).execute({ sessionKey: GUEST });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.items).toHaveLength(2);
      expect(r.value.subtotalAmount).toBe(2 * 1500 + 1 * 4000);
      expect(r.value.items[0]!.productName).toBe('Widget');
    }
  });
});

describe('MergeGuestCartUseCase', () => {
  it('merges guest into user cart, deletes guest cart', async () => {
    const carts = new InMemoryCartRepository();
    const catalog = makeCatalog();
    const add = new AddToCartUseCase(carts, catalog);
    await add.execute({ sessionKey: GUEST, skuId: SKU_A, productId: PROD_A, quantity: 2, currency: 'USD' });
    await add.execute({ sessionKey: USER, skuId: SKU_A, productId: PROD_A, quantity: 1, currency: 'USD' });

    const r = await new MergeGuestCartUseCase(carts).execute({
      guestSessionKey: GUEST,
      userSessionKey: USER,
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.conflictDropped).toBe(false);
      expect(r.value.cart.items.find((i) => i.skuId === SKU_A)?.quantity).toBe(3);
    }
    expect(await carts.findBySessionKey(GUEST)).toBeNull();
  });

  it('on currency conflict, keeps user cart and signals conflictDropped', async () => {
    const carts = new InMemoryCartRepository();
    const catalog = makeCatalog();
    const add = new AddToCartUseCase(carts, catalog);
    await add.execute({ sessionKey: USER, skuId: SKU_A, productId: PROD_A, quantity: 1, currency: 'USD' });
    await add.execute({ sessionKey: GUEST, skuId: SKU_A, productId: PROD_A, quantity: 1, currency: 'VND' });

    const r = await new MergeGuestCartUseCase(carts).execute({
      guestSessionKey: GUEST,
      userSessionKey: USER,
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.conflictDropped).toBe(true);
      expect(r.value.cart.currency).toBe('USD');
      expect(r.value.cart.items[0]!.quantity).toBe(1);
    }
    expect(await carts.findBySessionKey(GUEST)).toBeNull();
  });
});
