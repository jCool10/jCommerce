import { z } from 'zod';
import { MoneySchema, CurrencySchema } from '../dtos/money.js';
import { CartItemSchema, OrderCancelReasonSchema } from '../dtos/order.js';

// Event versioning: the version field is a z.literal(1). New versions are added
// side-by-side (v2 schema), producers emit both during migration, and consumers
// must handle both before v1 is retired.

export const OrderCreatedV1Schema = z.object({
  version: z.literal(1),
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  items: z.array(CartItemSchema.extend({ unitPrice: MoneySchema })),
  total: MoneySchema,
  currency: CurrencySchema,
  createdAt: z.string().datetime(),
});
export type OrderCreatedV1 = z.infer<typeof OrderCreatedV1Schema>;

export const OrderConfirmedV1Schema = z.object({
  version: z.literal(1),
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  stripePaymentIntentId: z.string(),
  total: MoneySchema,
  confirmedAt: z.string().datetime(),
});
export type OrderConfirmedV1 = z.infer<typeof OrderConfirmedV1Schema>;

export const OrderCancelledV1Schema = z.object({
  version: z.literal(1),
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: OrderCancelReasonSchema,
  cancelledAt: z.string().datetime(),
});
export type OrderCancelledV1 = z.infer<typeof OrderCancelledV1Schema>;

export const OrderShippedV1Schema = z.object({
  version: z.literal(1),
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  shippedAt: z.string().datetime(),
});
export type OrderShippedV1 = z.infer<typeof OrderShippedV1Schema>;
