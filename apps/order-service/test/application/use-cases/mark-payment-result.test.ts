import { describe, expect, it } from 'vitest';
import { Cart } from '../../../src/domain/cart.entity.js';
import { isErr, isOk } from '../../../src/domain/common/result.js';
import { StartCheckoutUseCase } from '../../../src/application/use-cases/saga/start-checkout.use-case.js';
import { MarkPaymentSucceededUseCase } from '../../../src/application/use-cases/saga/mark-payment-succeeded.use-case.js';
import { MarkPaymentFailedUseCase } from '../../../src/application/use-cases/saga/mark-payment-failed.use-case.js';
import { InMemoryCartRepository } from '../../fakes/in-memory-cart.repository.js';
import { InMemoryOrderRepository } from '../../fakes/in-memory-order.repository.js';
import { FakeCatalogClient } from '../../fakes/fake-catalog.client.js';
import { FakePaymentGateway } from '../../fakes/fake-payment-gateway.js';

const USER = '22222222-2222-2222-2222-222222222222';
const SESSION = `user:${USER}`;
const SKU_A = '33333333-3333-3333-3333-3333333333aa';
const PROD_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const SHIPPING = {
  line1: '1 Demo St',
  city: 'Demo',
  postalCode: '12345',
  country: 'US',
};

interface Pipeline {
  start: StartCheckoutUseCase;
  succeeded: MarkPaymentSucceededUseCase;
  failed: MarkPaymentFailedUseCase;
  orders: InMemoryOrderRepository;
  catalog: FakeCatalogClient;
}

const setup = async (): Promise<Pipeline & { orderId: string; piid: string }> => {
  const carts = new InMemoryCartRepository();
  const orders = new InMemoryOrderRepository();
  const catalog = new FakeCatalogClient().seedSku({
    skuId: SKU_A,
    productId: 'p-a',
    productName: 'Widget',
    prices: { USD: 1500 },
    available: 10,
  });
  const payment = new FakePaymentGateway().enableIdempotency();

  // Seed cart + run StartCheckout so an order is in PAYMENT_PENDING.
  const cart = Cart.empty(SESSION);
  cart.addItem({ skuId: SKU_A, productId: PROD_A, quantity: 2, currency: 'USD' });
  await carts.save(cart);

  let n = 0;
  const ids = [
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  ];

  const start = new StartCheckoutUseCase({
    carts,
    orders,
    catalog,
    payment,
    newId: () => ids[n++ % ids.length]!,
  });
  const r = await start.execute({ sessionKey: SESSION, userId: USER, shippingAddress: SHIPPING });
  if (isErr(r)) throw new Error(`setup failed: ${r.error.kind}`);

  return {
    start,
    succeeded: new MarkPaymentSucceededUseCase(orders),
    failed: new MarkPaymentFailedUseCase(orders, catalog),
    orders,
    catalog,
    orderId: r.value.orderId,
    piid: r.value.clientSecret.replace('_secret', ''),
  };
};

describe('MarkPaymentSucceededUseCase', () => {
  it('transitions PAYMENT_PENDING → CONFIRMED + emits order.confirmed + acquires advisory lock', async () => {
    const { succeeded, orders, orderId } = await setup();
    const piid = (await orders.findById(orderId))!.stripePaymentIntentId!;

    const r = await succeeded.execute({ orderId, stripePaymentIntentId: piid });
    expect(isOk(r)).toBe(true);

    const order = await orders.findById(orderId);
    expect(order?.status).toBe('CONFIRMED');
    expect(orders.outbox.map((e) => e.routingKey)).toContain('order.confirmed');
    expect(orders.lockCalls).toContain(orderId);
  });

  it('is idempotent: replaying for an already-CONFIRMED order is a no-op', async () => {
    const { succeeded, orders, orderId } = await setup();
    const piid = (await orders.findById(orderId))!.stripePaymentIntentId!;

    await succeeded.execute({ orderId, stripePaymentIntentId: piid });
    const before = orders.outbox.length;
    const r = await succeeded.execute({ orderId, stripePaymentIntentId: piid });
    expect(isOk(r)).toBe(true);
    expect(orders.outbox.length).toBe(before); // no duplicate event
  });

  it('rejects mismatched payment intent id (defensive)', async () => {
    const { succeeded, orderId } = await setup();
    const r = await succeeded.execute({
      orderId,
      stripePaymentIntentId: 'pi_wrong_handle',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('PAYMENT_INTENT_MISMATCH');
  });

  it('ORDER_NOT_FOUND when orderId unknown', async () => {
    const { succeeded } = await setup();
    const r = await succeeded.execute({
      orderId: '99999999-9999-9999-9999-999999999999',
      stripePaymentIntentId: 'pi_x',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('ORDER_NOT_FOUND');
  });
});

describe('MarkPaymentFailedUseCase', () => {
  it('releases inventory + cancels order + emits order.cancelled', async () => {
    const { failed, orders, catalog, orderId } = await setup();

    const r = await failed.execute({
      orderId,
      reason: 'card_declined',
    });
    expect(isOk(r)).toBe(true);

    const order = await orders.findById(orderId);
    expect(order?.status).toBe('CANCELLED');
    expect(order?.cancelReason).toBe('PAYMENT_FAILED');
    expect(catalog.releaseCalls).toContain(orderId);
    expect(orders.outbox.map((e) => e.routingKey)).toContain('order.cancelled');
    expect(orders.lockCalls).toContain(orderId);
  });

  it('is idempotent: second invocation is a no-op (already CANCELLED)', async () => {
    const { failed, orders, orderId } = await setup();
    await failed.execute({ orderId, reason: 'card_declined' });
    const releaseCallsBefore = orders.outbox.length;
    const r = await failed.execute({ orderId, reason: 'card_declined' });
    expect(isOk(r)).toBe(true);
    expect(orders.outbox.length).toBe(releaseCallsBefore); // no duplicate
  });
});
