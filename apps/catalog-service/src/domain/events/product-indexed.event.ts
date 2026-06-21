import { ROUTING_KEYS, type ProductIndexedV1 } from '@jcool/contracts';

export const PRODUCT_INDEXED_ROUTING_KEY = ROUTING_KEYS.PRODUCT_INDEXED;

export const buildProductIndexedV1 = (
  productId: string,
  action: ProductIndexedV1['action'],
): ProductIndexedV1 => ({
  version: 1,
  productId,
  action,
  indexedAt: new Date().toISOString(),
});
