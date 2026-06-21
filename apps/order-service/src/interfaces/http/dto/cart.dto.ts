import { z } from 'zod';
import { CurrencySchema } from '@jcool/contracts';

export const AddToCartBodySchema = z.object({
  productId: z.string().uuid(),
  skuId: z.string().uuid(),
  quantity: z.number().int().positive(),
  currency: CurrencySchema,
});
export type AddToCartBody = z.infer<typeof AddToCartBodySchema>;

export const UpdateCartItemBodySchema = z.object({
  quantity: z.number().int().nonnegative(),
});
export type UpdateCartItemBody = z.infer<typeof UpdateCartItemBodySchema>;

// guestSessionKey is a UUID set by the storefront on first visit. Validating
// as UUID caps Redis memory pressure + closes log/key-format injection
// vectors via the `X-Guest-Session` header.
export const MergeCartBodySchema = z.object({
  guestSessionKey: z.string().uuid(),
});
export type MergeCartBody = z.infer<typeof MergeCartBodySchema>;
