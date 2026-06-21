import { z } from 'zod';
import { MoneySchema, CurrencySchema } from './money.js';

export const CartItemSchema = z.object({
  skuId: z.string().uuid(),
  quantity: z.number().int().positive(),
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const CheckoutInputSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(CartItemSchema).nonempty(),
  currency: CurrencySchema,
  shippingAddress: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    region: z.string().optional(),
    postalCode: z.string().min(1),
    country: z.string().length(2),
  }),
});
export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;

export const OrderStatusSchema = z.enum([
  'PENDING',
  'INVENTORY_RESERVED',
  'PAYMENT_PENDING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderCancelReasonSchema = z.enum([
  'INVENTORY_FAILED',
  'PAYMENT_FAILED',
  'USER_CANCELLED',
  'ADMIN_CANCELLED',
  'TIMEOUT',
]);
export type OrderCancelReason = z.infer<typeof OrderCancelReasonSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: OrderStatusSchema,
  items: z.array(
    CartItemSchema.extend({
      unitPrice: MoneySchema,
    }),
  ),
  total: MoneySchema,
  stripePaymentIntentId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Order = z.infer<typeof OrderSchema>;
