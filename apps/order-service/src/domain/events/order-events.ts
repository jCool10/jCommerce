import {
  ROUTING_KEYS,
  type OrderCancelledV1,
  type OrderCancelReason,
  type OrderConfirmedV1,
  type OrderCreatedV1,
  type OrderShippedV1,
} from '@jcool/contracts';
import type { Order } from '../order.entity.js';
import type { OutboxAppend, OrderEventAppend } from '../ports/order.repository.js';

// Each helper returns BOTH an outbox row (for RabbitMQ publication) and an
// audit row (for the order_events table). The saga / use cases construct
// these and hand them to `OrderRepository.save(order, outbox, audit)` so
// everything lands in the same DB transaction.

const buildOrderCreated = (order: Order): OrderCreatedV1 => ({
  version: 1,
  orderId: order.id,
  userId: order.userId,
  items: order.items.map((i) => ({
    skuId: i.skuId,
    quantity: i.quantity,
    unitPrice: { currency: i.currency, amount: i.unitAmount },
  })),
  total: { currency: order.currency, amount: order.totalAmount },
  currency: order.currency,
  createdAt: order.createdAt.toISOString(),
});

export const orderCreatedEvents = (
  order: Order,
): { outbox: OutboxAppend; audit: OrderEventAppend } => {
  const payload = buildOrderCreated(order);
  return {
    outbox: { routingKey: ROUTING_KEYS.ORDER_CREATED, payload },
    audit: { type: 'order.created', payload },
  };
};

export const orderConfirmedEvents = (
  order: Order,
): { outbox: OutboxAppend; audit: OrderEventAppend } => {
  if (order.stripePaymentIntentId === null) {
    throw new Error('Cannot build order.confirmed event without stripePaymentIntentId');
  }
  const payload: OrderConfirmedV1 = {
    version: 1,
    orderId: order.id,
    userId: order.userId,
    stripePaymentIntentId: order.stripePaymentIntentId,
    total: { currency: order.currency, amount: order.totalAmount },
    confirmedAt: order.updatedAt.toISOString(),
  };
  return {
    outbox: { routingKey: ROUTING_KEYS.ORDER_CONFIRMED, payload },
    audit: { type: 'order.confirmed', payload },
  };
};

export const orderCancelledEvents = (
  order: Order,
  reason: OrderCancelReason,
): { outbox: OutboxAppend; audit: OrderEventAppend } => {
  const payload: OrderCancelledV1 = {
    version: 1,
    orderId: order.id,
    userId: order.userId,
    reason,
    cancelledAt: order.updatedAt.toISOString(),
  };
  return {
    outbox: { routingKey: ROUTING_KEYS.ORDER_CANCELLED, payload },
    audit: { type: 'order.cancelled', payload },
  };
};

export const orderShippedEvents = (
  order: Order,
): { outbox: OutboxAppend; audit: OrderEventAppend } => {
  const payload: OrderShippedV1 = {
    version: 1,
    orderId: order.id,
    userId: order.userId,
    shippedAt: order.updatedAt.toISOString(),
  };
  return {
    outbox: { routingKey: ROUTING_KEYS.ORDER_SHIPPED, payload },
    audit: { type: 'order.shipped', payload },
  };
};

export const orderDeliveredAudit = (order: Order): OrderEventAppend => ({
  type: 'order.delivered',
  payload: {
    orderId: order.id,
    userId: order.userId,
    deliveredAt: order.updatedAt.toISOString(),
  },
});
