import { z } from 'zod';
import { MoneySchema } from './money.js';

export const SkuSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1),
  // Multi-currency: a SKU can list explicit prices per currency (USD + VND).
  prices: z.array(MoneySchema).nonempty(),
  stock: z.number().int().nonnegative(),
  attributes: z.record(z.string(), z.string()).default({}),
});
export type Sku = z.infer<typeof SkuSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  categoryId: z.string().uuid(),
  images: z.array(z.string().url()).default([]),
  skus: z.array(SkuSchema).nonempty(),
  isActive: z.boolean().default(true),
});
export type Product = z.infer<typeof ProductSchema>;

export const InventoryQuerySchema = z.object({
  skuId: z.string().uuid(),
});
export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;

export const InventoryReadSchema = z.object({
  skuId: z.string().uuid(),
  available: z.number().int().nonnegative(),
});
export type InventoryRead = z.infer<typeof InventoryReadSchema>;
