import type { Currency } from '@jcool/contracts';
import type { Result } from '../common/result.js';
import type { OrderError } from '../order-error.js';

export interface CatalogSkuView {
  skuId: string;
  productId: string;
  productName: string;
  unitAmount: number;
  currency: Currency;
  available: number;
}

export interface ReserveInventoryRequest {
  orderId: string;
  items: Array<{ skuId: string; quantity: number }>;
}

export interface GetSkuRequest {
  skuId: string;
  productId: string;
  currency: Currency;
}

/**
 * Driven-side port: order-service depends only on this interface, never on
 * the HTTP adapter. The infrastructure adapter implements it via undici
 * against catalog-service `/api/v1/inventory/*` + `/api/v1/products/...`.
 *
 * `getSku` requires the parent `productId` because catalog only exposes a
 * by-product lookup. The storefront passes productId on every cart add
 * (it already has it from the product detail page); the order-service
 * persists it on the cart line so checkout can re-fetch without a scan.
 *
 * All methods return Result so transport failures map to OrderError.
 */
export interface CatalogClient {
  getSku(req: GetSkuRequest): Promise<Result<CatalogSkuView, OrderError>>;
  reserveInventory(req: ReserveInventoryRequest): Promise<Result<void, OrderError>>;
  releaseInventory(orderId: string): Promise<Result<void, OrderError>>;
}

export const CATALOG_CLIENT = Symbol('CATALOG_CLIENT');
