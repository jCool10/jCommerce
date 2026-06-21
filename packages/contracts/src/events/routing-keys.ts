// Mirrors the topology in infra/rabbitmq/definitions.json — keep both in lockstep.

export const ROUTING_KEYS = {
  ORDER_CREATED: 'order.created',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_FAILED: 'inventory.failed',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_SHIPPED: 'order.shipped',
  PRODUCT_INDEXED: 'product.indexed',
} as const;

export type RoutingKey = (typeof ROUTING_KEYS)[keyof typeof ROUTING_KEYS];

export const EVENTS_EXCHANGE = 'events';
export const EVENTS_DLX = 'events.dlx';
