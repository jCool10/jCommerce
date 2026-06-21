import type { Currency, OrderStatus, OrderCancelReason } from '@jcool/contracts';

// Tagged union for every failure mode the order domain produces.
// HTTP mapper translates each kind into a stable status + error code.

export type OrderError =
  // FSM / lifecycle
  | { kind: 'INVALID_TRANSITION'; from: OrderStatus; to: OrderStatus }
  | { kind: 'PAYMENT_INTENT_MISSING' }
  | { kind: 'PAYMENT_INTENT_ALREADY_SET' }
  // cart / checkout
  | { kind: 'CART_EMPTY' }
  | { kind: 'CART_NOT_FOUND'; sessionKey: string }
  | { kind: 'CART_CURRENCY_LOCKED'; locked: Currency; attempted: Currency }
  | { kind: 'CART_ITEM_NOT_FOUND'; skuId: string }
  | { kind: 'INVALID_QUANTITY'; reason: 'NON_POSITIVE' | 'EXCEEDS_LIMIT' }
  // catalog dependency failures
  | { kind: 'SKU_NOT_FOUND'; skuId: string }
  | { kind: 'SKU_PRICE_MISSING'; skuId: string; currency: Currency }
  | { kind: 'INSUFFICIENT_STOCK'; skuId: string; requested: number; available: number }
  | { kind: 'CATALOG_UNAVAILABLE'; reason: string }
  // saga / payment
  | { kind: 'PAYMENT_GATEWAY_FAILED'; reason: string }
  | { kind: 'PAYMENT_INTENT_MISMATCH'; expected: string; got: string }
  // queries / authz
  | { kind: 'ORDER_NOT_FOUND'; orderId: string }
  | { kind: 'UNAUTHORIZED' }
  | { kind: 'FORBIDDEN' };

export type OrderErrorKind = OrderError['kind'];

export const cancelReasonFromError = (
  err: Extract<OrderError, { kind: 'INSUFFICIENT_STOCK' | 'PAYMENT_GATEWAY_FAILED' }>,
): OrderCancelReason => {
  switch (err.kind) {
    case 'INSUFFICIENT_STOCK':
      return 'INVENTORY_FAILED';
    case 'PAYMENT_GATEWAY_FAILED':
      return 'PAYMENT_FAILED';
  }
};
