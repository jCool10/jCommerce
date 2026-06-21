import type { Currency } from '@jcool/contracts';

export type CatalogError =
  | { kind: 'PRODUCT_NOT_FOUND'; productId: string }
  | { kind: 'PRODUCT_MISSING_SKUS' }
  | { kind: 'SKU_NOT_FOUND'; skuId: string }
  | { kind: 'SKU_MISSING_DEFAULT_CURRENCY_PRICE'; currency: Currency }
  | { kind: 'SKU_DUPLICATE_PRICE_CURRENCY'; currency: Currency }
  | { kind: 'INVALID_PRICE'; reason: 'NEGATIVE' | 'NON_INTEGER' }
  | { kind: 'INVALID_QUANTITY'; reason: 'NON_POSITIVE' }
  | {
      kind: 'INSUFFICIENT_STOCK';
      skuId: string;
      requested: number;
      available: number;
    }
  | { kind: 'OVER_RELEASE'; skuId: string; requested: number; reserved: number }
  | { kind: 'CATEGORY_NOT_FOUND'; categoryId: string }
  | { kind: 'UNAUTHORIZED' }
  | { kind: 'FORBIDDEN' };
