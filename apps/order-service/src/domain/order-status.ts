import type { OrderStatus } from '@jcool/contracts';

// FSM table for Order aggregate. Source of truth — referenced by both
// Order.transitionTo() and the unit tests so reviewers can see at a glance
// which transitions are legal.
//
// Lifecycle:
//   PENDING → INVENTORY_RESERVED → PAYMENT_PENDING → CONFIRMED → SHIPPED → DELIVERED
//   Any pre-SHIPPED state may transition to CANCELLED (compensation or admin/user cancel).
//   SHIPPED / DELIVERED are terminal for forward motion (returns are out of scope for MVP).

export const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['INVENTORY_RESERVED', 'CANCELLED'],
  INVENTORY_RESERVED: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  VALID_TRANSITIONS[from].includes(to);

export const isTerminal = (status: OrderStatus): boolean =>
  VALID_TRANSITIONS[status].length === 0;
