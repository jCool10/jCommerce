import { z } from 'zod';
import { CurrencySchema } from '@jcool/contracts';

const SkuPriceInputSchema = z.object({
  currency: CurrencySchema,
  unitAmount: z.number().int().nonnegative(),
});

const SkuInputSchema = z.object({
  sku: z.string().min(1),
  attributes: z.record(z.string(), z.string()).default({}),
  prices: z.array(SkuPriceInputSchema).min(1),
  initialStock: z.number().int().nonnegative().default(0),
});

export const CreateProductBodySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  categoryId: z.string().uuid(),
  images: z.array(z.string().url()).default([]),
  isActive: z.boolean().default(true),
  skus: z.array(SkuInputSchema).min(1),
});
export type CreateProductBody = z.infer<typeof CreateProductBodySchema>;

export const UpdateProductBodySchema = z.object({
  slug: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  images: z.array(z.string().url()).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateProductBody = z.infer<typeof UpdateProductBodySchema>;

export const UpsertSkuBodySchema = z.object({
  skuId: z.string().uuid().optional(),
  sku: z.string().min(1),
  attributes: z.record(z.string(), z.string()).default({}),
  prices: z.array(SkuPriceInputSchema).min(1),
  initialStock: z.number().int().nonnegative().optional(),
});
export type UpsertSkuBody = z.infer<typeof UpsertSkuBodySchema>;

export const ListProductsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z
    .preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean())
    .optional(),
  search: z.string().optional(),
  currency: CurrencySchema.default('USD'),
});
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;

export const GetProductQuerySchema = z.object({
  currency: CurrencySchema.default('USD'),
  // Admin opts in to see deactivated products for editing. Public callers
  // (storefront, order-service catalog client) omit it, so inactive
  // products surface as 404 — preventing purchase via the direct-link
  // → add-to-cart path.
  include_inactive: z
    .preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean())
    .optional(),
});
export type GetProductQuery = z.infer<typeof GetProductQuerySchema>;
