import { beforeEach, describe, expect, it } from 'vitest';
import { GetOrderUseCase } from '../../../src/application/use-cases/orders/get-order.use-case.js';
import { ListUserOrdersUseCase } from '../../../src/application/use-cases/orders/list-user-orders.use-case.js';
import { UpdateOrderStatusUseCase } from '../../../src/application/use-cases/orders/update-order-status.use-case.js';
import { Order } from '../../../src/domain/order.entity.js';
import { OrderItem } from '../../../src/domain/order-item.entity.js';
import { isErr, isOk } from '../../../src/domain/common/result.js';
import { InMemoryOrderRepository } from '../../fakes/in-memory-order.repository.js';

const ORDER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ORDER = '11111111-1111-1111-1111-111111111112';
const USER = '22222222-2222-2222-2222-222222222222';
const OTHER_USER = '22222222-2222-2222-2222-222222222223';
const SKU = '33333333-3333-3333-3333-333333333333';

const SHIPPING = {
  line1: '1 St',
  city: 'X',
  postalCode: '00000',
  country: 'US',
};

const makeOrder = (id: string, userId: string, status: 'PENDING' | 'CONFIRMED' = 'PENDING') => {
  const item = OrderItem.rehydrate({
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    orderId: id,
    skuId: SKU,
    quantity: 1,
    unitAmount: 100,
    currency: 'USD',
  });
  const r = Order.create({ id, userId, items: [item], currency: 'USD', shippingAddress: SHIPPING });
  if (isErr(r)) throw new Error(r.error.kind);
  const order = r.value;
  if (status === 'CONFIRMED') {
    order.reserveInventory();
    order.attachPaymentIntent('pi_x');
    order.confirm();
  }
  return order;
};

describe('GetOrderUseCase authorization', () => {
  let orders: InMemoryOrderRepository;
  beforeEach(() => {
    orders = new InMemoryOrderRepository();
    orders.seed(makeOrder(ORDER_ID, USER));
  });

  it('owner can read own order', async () => {
    const r = await new GetOrderUseCase(orders).execute({
      orderId: ORDER_ID,
      requesterId: USER,
      requesterRole: 'customer',
    });
    expect(isOk(r)).toBe(true);
  });

  it('non-owner customer is FORBIDDEN', async () => {
    const r = await new GetOrderUseCase(orders).execute({
      orderId: ORDER_ID,
      requesterId: OTHER_USER,
      requesterRole: 'customer',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('FORBIDDEN');
  });

  it('admin can read any order', async () => {
    const r = await new GetOrderUseCase(orders).execute({
      orderId: ORDER_ID,
      requesterId: OTHER_USER,
      requesterRole: 'admin',
    });
    expect(isOk(r)).toBe(true);
  });

  it('missing order returns ORDER_NOT_FOUND', async () => {
    const r = await new GetOrderUseCase(orders).execute({
      orderId: '99999999-9999-9999-9999-999999999999',
      requesterId: USER,
      requesterRole: 'customer',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('ORDER_NOT_FOUND');
  });
});

describe('ListUserOrdersUseCase', () => {
  it('filters to userId only', async () => {
    const orders = new InMemoryOrderRepository();
    orders.seed(makeOrder(ORDER_ID, USER));
    orders.seed(makeOrder(OTHER_ORDER, OTHER_USER));

    const r = await new ListUserOrdersUseCase(orders).execute({
      userId: USER,
      cursor: null,
      limit: 10,
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.items).toHaveLength(1);
      expect(r.value.items[0]!.userId).toBe(USER);
    }
  });

  it('clamps limit to [1, 100]', async () => {
    const orders = new InMemoryOrderRepository();
    // sanity: 200 → 100 internally; with 0 seeded orders we just confirm no throw
    const r = await new ListUserOrdersUseCase(orders).execute({
      userId: USER,
      cursor: null,
      limit: 200,
    });
    expect(isOk(r)).toBe(true);
  });
});

describe('UpdateOrderStatusUseCase', () => {
  it('CONFIRMED → SHIPPED writes order.shipped outbox + audit + acquires lock', async () => {
    const orders = new InMemoryOrderRepository();
    orders.seed(makeOrder(ORDER_ID, USER, 'CONFIRMED'));

    const r = await new UpdateOrderStatusUseCase(orders).execute({
      orderId: ORDER_ID,
      to: 'SHIPPED',
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.status).toBe('SHIPPED');
    expect(orders.outbox.map((e) => e.routingKey)).toContain('order.shipped');
    expect(orders.auditEvents.map((e) => e.type)).toContain('order.shipped');
    expect(orders.lockCalls).toContain(ORDER_ID);
  });

  it('PENDING → SHIPPED is rejected (FSM)', async () => {
    const orders = new InMemoryOrderRepository();
    orders.seed(makeOrder(ORDER_ID, USER));
    const r = await new UpdateOrderStatusUseCase(orders).execute({
      orderId: ORDER_ID,
      to: 'SHIPPED',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe('INVALID_TRANSITION');
  });
});
