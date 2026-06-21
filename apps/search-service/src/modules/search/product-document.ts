import type { Money } from '@jcool/contracts';
import type { CatalogProduct } from '../catalog/catalog-product.dto.js';

/** Schema-strict shape stored in Elasticsearch — mirrors `product-index-mapping.ts`. */
export interface ProductDocument {
  productId: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  image: string | null;
  isActive: boolean;
  priceUsd: number | null;
  priceVnd: number | null;
  inStock: boolean;
  suggest: { input: string[] };
  indexedAt: string;
}

/**
 * Merge two single-currency Catalog projections of the same product into one
 * dual-currency document for Elasticsearch. Either side may be null (e.g. SKU
 * missing a VND price). The lowest SKU price per currency is used so the
 * storefront card can show "from $X".
 */
export function buildProductDocument(args: {
  usd: CatalogProduct | null;
  vnd: CatalogProduct | null;
  indexedAt: string;
}): ProductDocument | null {
  const primary = args.usd ?? args.vnd;
  if (!primary) return null;

  const inStock = primary.skus.some((sku) => sku.stock > 0);
  return {
    productId: primary.id,
    slug: primary.slug,
    name: primary.name,
    description: primary.description,
    categoryId: primary.categoryId,
    image: primary.images[0] ?? null,
    isActive: primary.isActive,
    priceUsd: lowestPriceFor(args.usd, 'USD'),
    priceVnd: lowestPriceFor(args.vnd, 'VND'),
    inStock,
    suggest: { input: suggestInputs(primary.name) },
    indexedAt: args.indexedAt,
  };
}

function lowestPriceFor(product: CatalogProduct | null, currency: 'USD' | 'VND'): number | null {
  if (!product) return null;
  const amounts = product.skus
    .flatMap((sku) => sku.prices)
    .filter((money: Money) => money.currency === currency)
    .map((money) => money.amount);
  return amounts.length > 0 ? Math.min(...amounts) : null;
}

/**
 * Completion suggester expects an array of phrase inputs. Including the full
 * name plus its tokens lets autocomplete match "mac" → "MacBook Pro".
 */
function suggestInputs(name: string): string[] {
  const tokens = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 2);
  return Array.from(new Set([name, ...tokens]));
}
