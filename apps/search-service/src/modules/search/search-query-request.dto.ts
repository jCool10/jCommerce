import { z } from 'zod';
import { CurrencySchema } from '@jcool/contracts';

/**
 * HTTP-facing copy of `SearchQuerySchema` from contracts: same shape, but
 * uses `z.coerce.number()` so query-string strings (`?page=2`) are accepted.
 * Output type matches `SearchQuery` from `@jcool/contracts` exactly.
 */
export const SearchQueryRequestSchema = z.object({
  q: z.string().default(''),
  categoryId: z.string().uuid().optional(),
  currency: CurrencySchema.optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest']).default('relevance'),
});
export type SearchQueryRequest = z.infer<typeof SearchQueryRequestSchema>;
