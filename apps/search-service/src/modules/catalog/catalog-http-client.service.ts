import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'undici';
import {
  CatalogListResponseSchema,
  CatalogProductSchema,
  type CatalogListResponse,
  type CatalogProduct,
} from './catalog-product.dto.js';

const REQUEST_TIMEOUTS = { headersTimeout: 5_000, bodyTimeout: 10_000 } as const;

export class CatalogHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(`Catalog HTTP ${statusCode} for ${url}: ${body.slice(0, 200)}`);
    this.name = 'CatalogHttpError';
  }
}

/**
 * Thin REST client for catalog-service. Only consumes public read endpoints
 * (`GET /api/v1/products[/:id]`) — admin mutations stay inside catalog.
 *
 * Currency note: catalog projects SKU prices to a single currency per call.
 * The reindex/enrichment flow calls once per supported currency and merges
 * the results — see `getProductWithAllCurrencies()`.
 */
@Injectable()
export class CatalogHttpClient {
  private readonly logger = new Logger(CatalogHttpClient.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get<string>('CATALOG_SERVICE_URL') ?? 'http://localhost:3002';
  }

  async getProduct(productId: string, currency: 'USD' | 'VND'): Promise<CatalogProduct | null> {
    const url = `${this.baseUrl}/api/v1/products/${productId}?currency=${currency}`;
    const res = await request(url, { method: 'GET', ...REQUEST_TIMEOUTS });
    if (res.statusCode === 404) return null;
    const body = await res.body.text();
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new CatalogHttpError(res.statusCode, url, body);
    }
    return CatalogProductSchema.parse(JSON.parse(body));
  }

  async listProducts(args: {
    cursor?: string;
    limit: number;
    currency: 'USD' | 'VND';
  }): Promise<CatalogListResponse> {
    const params = new URLSearchParams({
      limit: String(args.limit),
      currency: args.currency,
    });
    if (args.cursor) params.set('cursor', args.cursor);
    const url = `${this.baseUrl}/api/v1/products?${params.toString()}`;
    const res = await request(url, { method: 'GET', ...REQUEST_TIMEOUTS });
    const body = await res.body.text();
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new CatalogHttpError(res.statusCode, url, body);
    }
    return CatalogListResponseSchema.parse(JSON.parse(body));
  }
}
