import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchClientService } from '../elasticsearch/elasticsearch-client.service.js';
import { IndexAliasManagerService } from '../elasticsearch/index-alias-manager.service.js';
import {
  CatalogHttpClient,
  CatalogHttpError,
} from '../catalog/catalog-http-client.service.js';
import type { CatalogProduct } from '../catalog/catalog-product.dto.js';
import { buildProductDocument, type ProductDocument } from '../search/product-document.js';

/**
 * Resolves a catalog product into an ES document and applies the upsert/delete.
 * Shared between the live consumer and the bulk reindex path.
 */
@Injectable()
export class ProductDocumentIndexerService {
  private readonly logger = new Logger(ProductDocumentIndexerService.name);

  constructor(
    private readonly es: ElasticsearchClientService,
    private readonly alias: IndexAliasManagerService,
    private readonly catalog: CatalogHttpClient,
  ) {}

  async upsertByProductId(
    productId: string,
    indexedAt: string,
    targetIndex?: string,
  ): Promise<{ indexed: boolean }> {
    const [usd, vnd] = await Promise.all([
      this.fetchProduct(productId, 'USD'),
      this.fetchProduct(productId, 'VND'),
    ]);
    if (!usd && !vnd) {
      this.logger.warn(`Product ${productId} not found in catalog — skipping index`);
      return { indexed: false };
    }
    const doc = buildProductDocument({ usd, vnd, indexedAt });
    if (!doc) return { indexed: false };
    await this.indexDocument(doc, targetIndex);
    return { indexed: true };
  }

  /**
   * 404 = product gone; treat as null.
   * 4xx (e.g. catalog's `SKU_MISSING_DEFAULT_CURRENCY_PRICE` when the SKU has no price
   * row in this currency) is a valid domain state — degrade to null for this currency
   * so the other-currency projection still indexes. 5xx is retryable → re-throw → nack.
   */
  private async fetchProduct(
    productId: string,
    currency: 'USD' | 'VND',
  ): Promise<CatalogProduct | null> {
    try {
      return await this.catalog.getProduct(productId, currency);
    } catch (error) {
      if (
        error instanceof CatalogHttpError &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        this.logger.warn(
          `Catalog ${error.statusCode} for ${productId}/${currency} — projecting null`,
        );
        return null;
      }
      throw error;
    }
  }

  async indexDocument(doc: ProductDocument, targetIndex?: string): Promise<void> {
    await this.es.raw.index({
      index: targetIndex ?? this.alias.alias,
      id: doc.productId,
      document: doc,
      refresh: false,
    });
  }

  async deleteByProductId(productId: string): Promise<{ deleted: boolean }> {
    try {
      await this.es.raw.delete({ index: this.alias.alias, id: productId, refresh: false });
      return { deleted: true };
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404) return { deleted: false };
      throw error;
    }
  }
}
