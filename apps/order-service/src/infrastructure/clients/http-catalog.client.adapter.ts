import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'undici';
import { type Currency, type Product, ProductSchema } from '@jcool/contracts';
import { err, ok, type Result } from '../../domain/common/result.js';
import type { OrderError } from '../../domain/order-error.js';
import type {
  CatalogClient,
  CatalogSkuView,
  GetSkuRequest,
  ReserveInventoryRequest,
} from '../../domain/ports/catalog.client.port.js';

/**
 * HTTP adapter implementing the CatalogClient port over undici.
 *
 * Endpoints consumed:
 *   GET  /api/v1/products/:productId?currency=...
 *   POST /api/v1/inventory/reserve
 *   POST /api/v1/inventory/release
 *
 * Storefront passes `productId` on every cart add (it has it from the
 * product detail page); order-service persists it on the cart line so
 * checkout's snapshot pass can resolve prices without a per-SKU scan.
 *
 * Timeouts: headers=5s, body=10s.
 */
@Injectable()
export class HttpCatalogClient implements CatalogClient {
  private readonly logger = new Logger(HttpCatalogClient.name);
  private readonly baseUrl: string;
  private readonly headersTimeoutMs: number;
  private readonly bodyTimeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('CATALOG_SERVICE_URL') ?? 'http://localhost:3002'
    ).replace(/\/$/, '');
    this.headersTimeoutMs = Number(
      config.get('CATALOG_HTTP_TIMEOUT_HEADERS_MS') ?? 5_000,
    );
    this.bodyTimeoutMs = Number(
      config.get('CATALOG_HTTP_TIMEOUT_BODY_MS') ?? 10_000,
    );
  }

  async getSku(req: GetSkuRequest): Promise<Result<CatalogSkuView, OrderError>> {
    return this.fetchSkuFromProduct(req.productId, req.skuId, req.currency);
  }

  async reserveInventory(
    req: ReserveInventoryRequest,
  ): Promise<Result<void, OrderError>> {
    try {
      const res = await request(`${this.baseUrl}/api/v1/inventory/reserve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: req.orderId, items: req.items }),
        headersTimeout: this.headersTimeoutMs,
        bodyTimeout: this.bodyTimeoutMs,
      });
      if (res.statusCode === 200) {
        await res.body.dump();
        return ok(undefined);
      }
      const body = (await res.body.json().catch(() => null)) as
        | { code?: string; details?: { skuId?: string; requested?: number; available?: number } }
        | null;
      if (res.statusCode === 409 && body?.code === 'INSUFFICIENT_STOCK') {
        return err({
          kind: 'INSUFFICIENT_STOCK',
          skuId: body.details?.skuId ?? req.items[0]!.skuId,
          requested: body.details?.requested ?? req.items[0]!.quantity,
          available: body.details?.available ?? 0,
        });
      }
      return err({
        kind: 'CATALOG_UNAVAILABLE',
        reason: `reserve status=${res.statusCode}`,
      });
    } catch (error) {
      this.logger.error(`reserveInventory failed: ${(error as Error).message}`);
      return err({
        kind: 'CATALOG_UNAVAILABLE',
        reason: (error as Error).message,
      });
    }
  }

  async releaseInventory(orderId: string): Promise<Result<void, OrderError>> {
    try {
      const res = await request(`${this.baseUrl}/api/v1/inventory/release`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId }),
        headersTimeout: this.headersTimeoutMs,
        bodyTimeout: this.bodyTimeoutMs,
      });
      await res.body.dump();
      if (res.statusCode === 200 || res.statusCode === 404) return ok(undefined);
      return err({
        kind: 'CATALOG_UNAVAILABLE',
        reason: `release status=${res.statusCode}`,
      });
    } catch (error) {
      this.logger.error(`releaseInventory failed: ${(error as Error).message}`);
      return err({
        kind: 'CATALOG_UNAVAILABLE',
        reason: (error as Error).message,
      });
    }
  }

  private async fetchSkuFromProduct(
    productId: string,
    skuId: string,
    currency: Currency,
  ): Promise<Result<CatalogSkuView, OrderError>> {
    try {
      const url = `${this.baseUrl}/api/v1/products/${productId}?currency=${currency}`;
      const res = await request(url, {
        method: 'GET',
        headersTimeout: this.headersTimeoutMs,
        bodyTimeout: this.bodyTimeoutMs,
      });
      if (res.statusCode === 404) return err({ kind: 'SKU_NOT_FOUND', skuId });
      if (res.statusCode !== 200) {
        return err({
          kind: 'CATALOG_UNAVAILABLE',
          reason: `getProduct status=${res.statusCode}`,
        });
      }
      const json = await res.body.json();
      const parsed = ProductSchema.safeParse(json);
      if (!parsed.success) {
        return err({
          kind: 'CATALOG_UNAVAILABLE',
          reason: 'schema mismatch on /products/:id',
        });
      }
      const product: Product = parsed.data;
      const sku = product.skus.find((s) => s.id === skuId);
      if (!sku) return err({ kind: 'SKU_NOT_FOUND', skuId });
      const price = sku.prices.find((p) => p.currency === currency);
      if (!price) return err({ kind: 'SKU_PRICE_MISSING', skuId, currency });
      return ok({
        skuId,
        productId,
        productName: product.name,
        unitAmount: price.amount,
        currency,
        available: sku.stock,
      });
    } catch (error) {
      return err({
        kind: 'CATALOG_UNAVAILABLE',
        reason: (error as Error).message,
      });
    }
  }
}
