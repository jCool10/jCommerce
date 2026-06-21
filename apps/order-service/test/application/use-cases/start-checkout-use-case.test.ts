import { describe, expect, it } from 'vitest';
import { Cart } from '../../../src/domain/cart.entity.js';
import { isErr, isOk, err } from '../../../src/domain/common/result.js';
import { StartCheckoutUseCase } from '../../../src/application/use-cases/saga/start-checkout.use-case.js';
import { InMemoryCartRepository } from '../../fakes/in-memory-cart.repository.js';
import { InMemoryOrderRepository } from '../../fakes/in-memory-order.repository.js';
import { FakeCatalogClient } from '../../fakes/fake-catalog.client.js';
import { FakePaymentGateway } from '../../fakes/fake-payment-gateway.js';

const USER = '22222222-2222-2222-2222-222222222222';
const GUEST = `user:${USER}`;
const SKU_A = '33333333-3333-3333-3333-3333333333aa';
const SKU_B = '33333333-3333-3333-3333-3333333333bb';
const PROD_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PROD_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const SHIPPING = {
  line1: '1 Demo St',
  city: 'Demo',
  postalCode: '12345',
  country: 'US',
};

const stubIdGen = () => {
  let n = 0;
  const ids = [
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111112',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  ];
  return () => ids[n++ % ids.length]!;
};

interface Sut {
  sut: StartCheckoutUseCase;
  carts: InMemoryCartRepository;
  orders: InMemoryOrderRepository;
  catalog: FakeCatalogClient;
  payment: FakePaymentGateway;
}

const makeSut = async (
  cartLines: Array<{ skuId: string; quantity: number }>,
): Promise<Sut> => {
  const carts = new InMemoryCartRepository();
  const orders = new InMemoryOrderRepository();
  const catalog = new FakeCatalogClient()
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
  const payment = new FakePaymentGateway().enableIdempotency();
  const cart = Cart.empty(GUEST);
  for (const l of cartLines) {
    const productId = l.skuId === SKU_A ? PROD_A : PROD_B;
    cart.addItem({ skuId: l.skuId, productId, quantity: l.quantity, currency: 'USD' });
  }
  await carts.save(cart);

  const sut = new StartCheckoutUseCase({
    carts,
    orders,
    catalog,
    payment,
    newId: stubIdGen(),
  });
  return { sut, carts, orders, catalog, payment };
};

describe('StartCheckoutUseCase — happy path', () => {
  it('reserves inventory, creates intent, saves order PAYMENT_PENDING, emits order.created, clears cart', async () => {
    const { sut, carts, orders, catalog, payment } = await makeSut([
      { skuId: SKU_A, quantity: 2 },
      { skuId: SKU_B, quantity: 1 },
    ]);

    const r = await sut.execute({
      sessionKey: GUEST,
      userId: USER,
      shippingAddress: SHIPPING,
    });

    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.clientSecret).toMatch(/^pi_fake_/);
      expect(r.value.orderId).toBeTruthy();
    }

    // Catalog: one reserve call, no release
    expect(catalog.reserveCalls).toHaveLength(1);
    expect(catalog.releaseCalls).toHaveLength(0);

    // Payment: one create call with correct amount/currency
    expect(payment.createCalls).toHaveLength(1);
    expect(payment.createCalls[0]!.amount).toBe(2 * 1500 + 1 * 4000);
    expect(payment.createCalls[0]!.currency).toBe('USD');

    // Order saved in PAYMENT_PENDING with stripePaymentIntentId set (F2)
    if (isOk(r)) {
      const order = await orders.findById(r.value.orderId);
      expect(order?.status).toBe('PAYMENT_PENDING');
      expect(order?.stripePaymentIntentId).not.toBeNull();
    }

    // Outbox: order.created event emitted
    expect(orders.outbox.map((e) => e.routingKey)).toContain('order.created');

    // Cart cleared
    expect(await carts.findBySessionKey(GUEST)).toBeNull();
  });

  it('snapshots SKU prices into OrderItem at order time (catalog drift will not retro-mutate)', async () => {
    const { sut, orders, catalog } = await makeSut([
      { skuId: SKU_A, quantity: 1 },
    ]);

    const r = await sut.execute({ sessionKey: GUEST, userId: USER, shippingAddress: SHIPPING });
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    const order = await orders.findById(r.value.orderId);
    expect(order?.items[0]!.unitAmount).toBe(1500);
    expect(order?.totalAmount).toBe(1500);

    // Even if catalog price changes later, order is unaffected
    catalog.seedSku({
      skuId: SKU_A,
      productId: 'p-a',
      productName: 'Widget',
      prices: { USD: 9999 },
      available: 10,
    });
    expect(order?.items[0]!.unitAmount).toBe(1500);
  });
});

describe('StartCheckoutUseCase — inventory compensation', () => {
  it('inventory reserve fails → order CANCELLED before Stripe call, no createIntent invoked', async () => {
    const { sut, orders, catalog, payment } = await makeSut([
      { skuId: SKU_A, quantity: 2 },
    ]);
    catalog.setReserveOutcome(
      err({ kind: 'INSUFFICIENT_STOCK', skuId: SKU_A, requested: 2, available: 0 }),
    );

    const r = await sut.execute({ sessionKey: GUEST, userId: USER, shippingAddress: SHIPPING });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('INSUFFICIENT_STOCK');

    // Stripe NEVER called
    expect(payment.createCalls).toHaveLength(0);

    // Order persisted in CANCELLED state with reason
    const cancelled = orders.countByStatus('CANCELLED');
    expect(cancelled).toBe(1);

    // Outbox: order.created NOT emitted (order never reached confirmed-creation),
    // order.cancelled IS emitted so downstream (email) can notify.
    expect(orders.outbox.map((e) => e.routingKey)).toContain('order.cancelled');
    expect(orders.outbox.map((e) => e.routingKey)).not.toContain('order.created');
  });
});

describe('StartCheckoutUseCase — payment compensation', () => {
  it('payment gateway error → release inventory + order CANCELLED + order.cancelled outbox', async () => {
    const { sut, orders, catalog, payment } = await makeSut([
      { skuId: SKU_A, quantity: 2 },
    ]);
    payment.setCreateOutcome(FakePaymentGateway.failedWith('card_declined'));

    const r = await sut.execute({ sessionKey: GUEST, userId: USER, shippingAddress: SHIPPING });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('PAYMENT_GATEWAY_FAILED');

    // Inventory: reserve called, release called (compensation)
    expect(catalog.reserveCalls).toHaveLength(1);
    expect(catalog.releaseCalls).toHaveLength(1);

    expect(orders.countByStatus('CANCELLED')).toBe(1);
    expect(orders.outbox.map((e) => e.routingKey)).toContain('order.cancelled');
  });
});

describe('StartCheckoutUseCase — guard rails', () => {
  it('rejects empty cart', async () => {
    const { sut } = await makeSut([]);
    const r = await sut.execute({ sessionKey: GUEST, userId: USER, shippingAddress: SHIPPING });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('CART_EMPTY');
  });

  it('rejects when a SKU price is missing for the cart currency', async () => {
    const { sut, catalog } = await makeSut([{ skuId: SKU_A, quantity: 1 }]);
    catalog.seedSku({
      skuId: SKU_A,
      productId: 'p-a',
      productName: 'Widget',
      prices: { VND: 350000 }, // USD missing — cart is USD
      available: 10,
    });
    const r = await sut.execute({ sessionKey: GUEST, userId: USER, shippingAddress: SHIPPING });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('SKU_PRICE_MISSING');
  });
});
