import { z } from 'zod';
import { CurrencySchema, MoneySchema } from './money.js';

export const SearchQuerySchema = z.object({
  q: z.string().default(''),
  categoryId: z.string().uuid().optional(),
  currency: CurrencySchema.optional(),
  minPrice: z.number().int().nonnegative().optional(),
  maxPrice: z.number().int().nonnegative().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest']).default('relevance'),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchHitSchema = z.object({
  productId: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  image: z.string().url().optional(),
  fromPrice: MoneySchema,
});
export type SearchHit = z.infer<typeof SearchHitSchema>;

export const FacetSchema = z.object({
  field: z.string(),
  buckets: z.array(
    z.object({
      key: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});
export type Facet = z.infer<typeof FacetSchema>;

export const SearchResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hits: z.array(SearchHitSchema),
  facets: z.array(FacetSchema).default([]),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
