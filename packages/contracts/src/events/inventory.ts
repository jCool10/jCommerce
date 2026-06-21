import { z } from 'zod';
import { CartItemSchema } from '../dtos/order.js';

export const InventoryReservedV1Schema = z.object({
  version: z.literal(1),
  orderId: z.string().uuid(),
  items: z.array(CartItemSchema),
  reservedAt: z.string().datetime(),
});
export type InventoryReservedV1 = z.infer<typeof InventoryReservedV1Schema>;

export const InventoryFailedV1Schema = z.object({
  version: z.literal(1),
  orderId: z.string().uuid(),
  reason: z.enum(['INSUFFICIENT_STOCK', 'UNKNOWN_SKU', 'INTERNAL_ERROR']),
  failedSkuIds: z.array(z.string().uuid()).default([]),
  failedAt: z.string().datetime(),
});
export type InventoryFailedV1 = z.infer<typeof InventoryFailedV1Schema>;
