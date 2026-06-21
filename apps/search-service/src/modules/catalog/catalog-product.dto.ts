import { z } from 'zod';
import { ProductSchema } from '@jcool/contracts';

// Catalog responds with a single-currency `prices` projection per Sku based on ?currency=.
// We fetch USD + VND in parallel and merge into the indexed document.
export const CatalogProductSchema = ProductSchema;
export type CatalogProduct = z.infer<typeof CatalogProductSchema>;

export const CatalogListResponseSchema = z.object({
  items: z.array(CatalogProductSchema),
  nextCursor: z.string().nullable(),
});
export type CatalogListResponse = z.infer<typeof CatalogListResponseSchema>;
