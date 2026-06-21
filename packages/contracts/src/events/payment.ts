import { z } from 'zod';
import { MoneySchema } from '../dtos/money.js';

export const PaymentSucceededV1Schema = z.object({
  version: z.literal(1),
  orderId: z.string().uuid(),
  stripePaymentIntentId: z.string(),
  amount: MoneySchema,
  succeededAt: z.string().datetime(),
});
export type PaymentSucceededV1 = z.infer<typeof PaymentSucceededV1Schema>;

export const PaymentFailedV1Schema = z.object({
  version: z.literal(1),
  orderId: z.string().uuid(),
  stripePaymentIntentId: z.string().optional(),
  reason: z.string(),
  failedAt: z.string().datetime(),
});
export type PaymentFailedV1 = z.infer<typeof PaymentFailedV1Schema>;
