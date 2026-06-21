import { z } from 'zod';

export const ProductIndexedV1Schema = z.object({
  version: z.literal(1),
  productId: z.string().uuid(),
  action: z.enum(['UPSERT', 'DELETE']),
  indexedAt: z.string().datetime(),
});
export type ProductIndexedV1 = z.infer<typeof ProductIndexedV1Schema>;
