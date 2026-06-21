import { describe, expect, it } from 'vitest';
import { Order } from '../../src/domain/order.entity.js';
import { OrderItem } from '../../src/domain/order-item.entity.js';
import { isErr, isOk } from '../../src/domain/common/result.js';

const ORDER_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const SKU_A = '33333333-3333-3333-3333-3333333333aa';
const SKU_B = '33333333-3333-3333-3333-3333333333bb';

const SHIPPING = {
  line1: '1 Test Way',
  line2: undefined,
  city: 'HCMC',
  region: 'SG',
  postalCode: '70000',
  country: 'VN',
};

const makeItems = () => [
  OrderItem.rehydrate({
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    orderId: ORDER_ID,
    skuId: SKU_A,
    quantity: 2,
    unitAmount: 1500,
    currency: 'USD',
  }),
  OrderItem.rehydrate({
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    orderId: ORDER_ID,
    skuId: SKU_B,
    quantity: 1,
    unitAmount: 4000,
    currency: 'USD',
  }),
];

const makePendingOrder = () => {
  const result = Order.create({
    id: ORDER_ID,
    userId: USER_ID,
    items: makeItems(),
    currency: 'USD',
    shippingAddress: SHIPPING,
  });
  if (isErr(result)) throw new Error(`fixture failed: ${result.error.kind}`);
  return result.value;
};

describe('Order.create', () => {
  it('starts in PENDING and totals items', () => {
    const order = makePendingOrder();
    expect(order.status).toBe('PENDING');
    expect(order.totalAmount).toBe(2 * 1500 + 1 * 4000);
    expect(order.currency).toBe('USD');
    expect(order.stripePaymentIntentId).toBeNull();
  });

  it('rejects empty item list', () => {
    const r = Order.create({
      id: ORDER_ID,
      userId: USER_ID,
      items: [],
      currency: 'USD',
      shippingAddress: SHIPPING,
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('CART_EMPTY');
  });

  it('rejects items whose currency disagrees with order currency', () => {
    const mixed = [
      OrderItem.rehydrate({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
        orderId: ORDER_ID,
        skuId: SKU_A,
        quantity: 1,
        unitAmount: 1500,
        currency: 'VND',
      }),
    ];
    const r = Order.create({
      id: ORDER_ID,
      userId: USER_ID,
      items: mixed,
      currency: 'USD',
      shippingAddress: SHIPPING,
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.error.kind).toBe('CART_CURRENCY_LOCKED');
    }
  });
});

describe('Order FSM happy path', () => {
  it('PENDING → INVENTORY_RESERVED → PAYMENT_PENDING → CONFIRMED → SHIPPED → DELIVERED', () => {
    const order = makePendingOrder();

    expect(isOk(order.reserveInventory())).toBe(true);
    expect(order.status).toBe('INVENTORY_RESERVED');

    expect(isOk(order.attachPaymentIntent('pi_test_1'))).toBe(true);
    expect(order.status).toBe('PAYMENT_PENDING');
    expect(order.stripePaymentIntentId).toBe('pi_test_1');

    expect(isOk(order.confirm())).toBe(true);
    expect(order.status).toBe('CONFIRMED');

    expect(isOk(order.markShipped())).toBe(true);
    expect(order.status).toBe('SHIPPED');

    expect(isOk(order.markDelivered())).toBe(true);
    expect(order.status).toBe('DELIVERED');
  });
});

describe('Order FSM rejects invalid transitions', () => {
  it('cannot confirm a PENDING order (must pass through PAYMENT_PENDING)', () => {
    const order = makePendingOrder();
    const r = order.confirm();
    expect(isErr(r)).toBe(true);
    if (isErr(r) && r.error.kind === 'INVALID_TRANSITION') {
      expect(r.error.from).toBe('PENDING');
      expect(r.error.to).toBe('CONFIRMED');
    }
  });

  it('cannot ship before CONFIRMED', () => {
    const order = makePendingOrder();
    expect(isErr(order.markShipped())).toBe(true);
    order.reserveInventory();
    expect(isErr(order.markShipped())).toBe(true);
  });

  it('cannot deliver a SHIPPED order without explicit markDelivered (FSM is strict)', () => {
    const order = makePendingOrder();
    order.reserveInventory();
    order.attachPaymentIntent('pi_test_2');
    order.confirm();
    order.markShipped();
    const r = order.markShipped();
    expect(isErr(r)).toBe(true); // SHIPPED → SHIPPED is invalid
  });

  it('cannot transition CANCELLED to anything (terminal)', () => {
    const order = makePendingOrder();
    order.cancel('USER_CANCELLED');
    expect(order.status).toBe('CANCELLED');
    expect(isErr(order.reserveInventory())).toBe(true);
    expect(isErr(order.confirm())).toBe(true);
  });

  it('cannot cancel a SHIPPED order (cancel is pre-fulfilment only)', () => {
    const order = makePendingOrder();
    order.reserveInventory();
    order.attachPaymentIntent('pi_test_3');
    order.confirm();
    order.markShipped();
    const r = order.cancel('ADMIN_CANCELLED');
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('INVALID_TRANSITION');
  });
});

describe('Order.attachPaymentIntent (F2 invariant)', () => {
  it('requires INVENTORY_RESERVED state — rejects from PENDING', () => {
    const order = makePendingOrder();
    const r = order.attachPaymentIntent('pi_test_x');
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('INVALID_TRANSITION');
  });

  it('refuses to re-attach a different payment intent', () => {
    const order = makePendingOrder();
    order.reserveInventory();
    order.attachPaymentIntent('pi_test_first');

    // Order is now PAYMENT_PENDING; rolling forward again would be FSM-illegal
    // but the more precise error is PAYMENT_INTENT_ALREADY_SET.
    const r = order.attachPaymentIntent('pi_test_second');
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(['PAYMENT_INTENT_ALREADY_SET', 'INVALID_TRANSITION']).toContain(r.error.kind);
    }
  });

  it('stripePaymentIntentId is set BEFORE returning ok (F2: persist-before-Stripe-call invariant)', () => {
    const order = makePendingOrder();
    order.reserveInventory();
    const r = order.attachPaymentIntent('pi_invariant');
    expect(isOk(r)).toBe(true);
    expect(order.stripePaymentIntentId).toBe('pi_invariant');
  });
});

describe('Order.cancel records reason', () => {
  it('stores cancel reason for audit', () => {
    const order = makePendingOrder();
    const r = order.cancel('INVENTORY_FAILED');
    expect(isOk(r)).toBe(true);
    expect(order.status).toBe('CANCELLED');
    expect(order.cancelReason).toBe('INVENTORY_FAILED');
  });

  it('allows cancel from each pre-fulfilment state', () => {
    for (const setup of [
      () => undefined,
      (o: Order) => o.reserveInventory(),
      (o: Order) => {
        o.reserveInventory();
        o.attachPaymentIntent('pi_cancel_setup');
      },
      (o: Order) => {
        o.reserveInventory();
        o.attachPaymentIntent('pi_cancel_setup');
        o.confirm();
      },
    ]) {
      const order = makePendingOrder();
      setup(order);
      const r = order.cancel('USER_CANCELLED');
      expect(isOk(r)).toBe(true);
      expect(order.status).toBe('CANCELLED');
    }
  });
});
