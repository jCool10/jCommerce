import { z } from 'zod';

export const ReserveInventoryBodySchema = z.object({
  orderId: z.string().uuid(),
  items: z
    .array(
      z.object({
        skuId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});
export type ReserveInventoryBody = z.infer<typeof ReserveInventoryBodySchema>;

export const ReleaseInventoryBodySchema = z.object({
  orderId: z.string().uuid(),
});
export type ReleaseInventoryBody = z.infer<typeof ReleaseInventoryBodySchema>;
