import type { Currency } from '@jcool/contracts';
import { Product } from '../../domain/product.entity.js';
import { Sku } from '../../domain/sku.entity.js';
import { SkuPrice } from '../../domain/sku-price.entity.js';

// Plain wire shape stored in Redis. Holds the static catalog aggregate only —
// every-currency prices but NO live stock. Availability is volatile (mutated by
// every reservation/release) so it is read fresh from Postgres on each request
// and merged after the cache lookup; caching it here would serve stale stock.
interface CachedSkuPrice {
  skuId: string;
  currency: Currency;
  unitAmount: number;
}

interface CachedSku {
  id: string;
  productId: string;
  sku: string;
  attributes: Record<string, string>;
  prices: CachedSkuPrice[];
}

interface CachedProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  images: string[];
  isActive: boolean;
  skus: CachedSku[];
}

const toCached = (product: Product): CachedProduct => ({
  id: product.id,
  slug: product.slug,
  name: product.name,
  description: product.description,
  categoryId: product.categoryId,
  images: product.images,
  isActive: product.isActive,
  skus: product.skus.map((sku) => ({
    id: sku.id,
    productId: sku.productId,
    sku: sku.code,
    attributes: sku.attributes,
    prices: sku.prices.map((p) => ({
      skuId: p.skuId,
      currency: p.currency,
      unitAmount: p.unitAmount,
    })),
  })),
});

const fromCached = (cached: CachedProduct): Product =>
  Product.rehydrate({
    id: cached.id,
    slug: cached.slug,
    name: cached.name,
    description: cached.description,
    categoryId: cached.categoryId,
    images: cached.images,
    isActive: cached.isActive,
    skus: cached.skus.map((s) =>
      Sku.rehydrate({
        id: s.id,
        productId: s.productId,
        sku: s.sku,
        attributes: s.attributes,
        prices: s.prices.map((p) =>
          SkuPrice.rehydrate({ skuId: p.skuId, currency: p.currency, unitAmount: p.unitAmount }),
        ),
      }),
    ),
  });

export const serializeProduct = (product: Product): string => JSON.stringify(toCached(product));

// Returns null on any malformed payload so the caller treats it as a cache miss
// (forward-compatible: an old cached shape simply re-reads from Postgres).
export const deserializeProduct = (raw: string): Product | null => {
  try {
    return fromCached(JSON.parse(raw) as CachedProduct);
  } catch {
    return null;
  }
};
