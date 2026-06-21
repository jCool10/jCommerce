import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchClientService } from '../elasticsearch/elasticsearch-client.service.js';
import { IndexAliasManagerService } from '../elasticsearch/index-alias-manager.service.js';
import {
  CatalogHttpClient,
  CatalogHttpError,
} from '../catalog/catalog-http-client.service.js';
import { ProductDocumentIndexerService } from '../consumer/product-document-indexer.service.js';
import { buildProductDocument } from '../search/product-document.js';
import type { CatalogProduct, CatalogListResponse } from '../catalog/catalog-product.dto.js';

export interface ReindexReport {
  newIndex: string;
  oldIndex: string | null;
  indexed: number;
  skipped: number;
  failed: number;
  durationMs: number;
}

@Injectable()
export class ReindexService {
  private readonly logger = new Logger(ReindexService.name);

  constructor(
    private readonly es: ElasticsearchClientService,
    private readonly alias: IndexAliasManagerService,
    private readonly catalog: CatalogHttpClient,
    private readonly indexer: ProductDocumentIndexerService,
    private readonly config: ConfigService,
  ) {}

  async run(): Promise<ReindexReport> {
    const started = Date.now();
    const newIndex = await this.alias.createNextIndex();
    this.logger.log(`Created next index ${newIndex}`);

    const fetchPageSize = Number(this.config.get<string>('REINDEX_FETCH_PAGE_SIZE') ?? 50);
    const bulkBatchSize = Number(this.config.get<string>('REINDEX_BATCH_SIZE') ?? 500);

    let indexed = 0;
    let skipped = 0;
    let failed = 0;
    let cursor: string | undefined;
    let docBuffer: unknown[] = [];

    do {
      const [usdPage, vndPage] = await Promise.all([
        this.catalog.listProducts({ cursor, limit: fetchPageSize, currency: 'USD' }),
        this.fetchVndPage(cursor, fetchPageSize),
      ]);

      const vndById = new Map<string, CatalogProduct>(
        vndPage.items.map((p) => [p.id, p]),
      );
      for (const usd of usdPage.items) {
        const vnd = vndById.get(usd.id) ?? null;
        const doc = buildProductDocument({
          usd,
          vnd,
          indexedAt: new Date().toISOString(),
        });
        if (!doc) {
          skipped += 1;
          continue;
        }
        docBuffer.push({ index: { _index: newIndex, _id: doc.productId } }, doc);
        if (docBuffer.length / 2 >= bulkBatchSize) {
          const flushed = await this.flush(docBuffer);
          indexed += flushed.indexed;
          failed += flushed.failed;
          docBuffer = [];
        }
      }
      cursor = usdPage.nextCursor ?? undefined;
    } while (cursor);

    if (docBuffer.length > 0) {
      const flushed = await this.flush(docBuffer);
      indexed += flushed.indexed;
      failed += flushed.failed;
    }

    await this.es.raw.indices.refresh({ index: newIndex });
    const swap = await this.alias.swapAliasTo(newIndex);
    if (swap.removed) {
      await this.alias.deleteIndex(swap.removed);
    }

    const durationMs = Date.now() - started;
    this.logger.log(
      `Reindex complete: indexed=${indexed} skipped=${skipped} failed=${failed} target=${newIndex} (${durationMs}ms; swapped from ${swap.removed ?? 'none'})`,
    );
    return { newIndex, oldIndex: swap.removed, indexed, skipped, failed, durationMs };
  }

  /**
   * VND fetch is decoupled from USD so a missing-currency 4xx from catalog
   * (e.g. an early product without a VND price row) does not abort the rebuild.
   * The reindex degrades to USD-only docs for the affected page; product-document
   * mapper handles `vnd=null` already.
   */
  private async fetchVndPage(
    cursor: string | undefined,
    limit: number,
  ): Promise<CatalogListResponse> {
    try {
      return await this.catalog.listProducts({ cursor, limit, currency: 'VND' });
    } catch (error) {
      if (error instanceof CatalogHttpError && error.statusCode >= 400 && error.statusCode < 500) {
        this.logger.warn(
          `VND page fetch returned ${error.statusCode}; indexing USD-only for this page`,
        );
        return { items: [], nextCursor: null };
      }
      throw error;
    }
  }

  private async flush(buffer: unknown[]): Promise<{ indexed: number; failed: number }> {
    if (buffer.length === 0) return { indexed: 0, failed: 0 };
    const res = await this.es.raw.bulk({
      operations: buffer as Record<string, unknown>[],
      refresh: false,
    });
    const total = buffer.length / 2;
    if (!res.errors) {
      return { indexed: total, failed: 0 };
    }
    const failed = res.items.reduce((acc, item) => {
      const op = Object.values(item)[0] as { status?: number } | undefined;
      return op && op.status !== undefined && op.status >= 400 ? acc + 1 : acc;
    }, 0);
    if (failed > 0) {
      this.logger.warn(`Bulk reindex partial failure: ${failed}/${total} doc(s) rejected`);
    }
    return { indexed: total - failed, failed };
  }
}
