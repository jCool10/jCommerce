import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Product } from '../../domain/product.entity.js';
import type {
  ProductListCursor,
  ProductListFilter,
  ProductListPage,
  ProductRepository,
} from '../../domain/ports/product.repository.js';
import type { OutboxAppend } from '../../domain/ports/outbox.repository.js';
import { RedisService } from '../cache/redis.service.js';
import { deserializeProduct, serializeProduct } from '../cache/product-cache.serializer.js';

const ID_KEY = (id: string): string => `catalog:product:id:${id}`;
const SLUG_KEY = (slug: string): string => `catalog:product:slug:${slug}`;

/**
 * Cache-aside decorator over a real ProductRepository.
 *
 * Hot single-product reads (findById/findBySlug) are served from Redis and fall
 * through to Postgres on a miss; writes evict the affected keys so the cache
 * never outlives a mutation. Every Redis call is best-effort — if the cache is
 * down the inner repository still answers, so catalog availability is never
 * coupled to Redis. List queries are intentionally not cached: cursor + filter +
 * search combinations have a poor hit rate and messy invalidation.
 */
@Injectable()
export class CachedProductRepository implements ProductRepository {
  private readonly logger = new Logger(CachedProductRepository.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly inner: ProductRepository,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.ttlSeconds = Number(config.get('PRODUCT_CACHE_TTL_SECONDS') ?? 300);
  }

  async findById(id: string): Promise<Product | null> {
    const cached = await this.readCache(ID_KEY(id));
    if (cached) return cached;

    const product = await this.inner.findById(id);
    if (product) await this.writeCache(product);
    return product;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const cached = await this.readCache(SLUG_KEY(slug));
    if (cached) return cached;

    const product = await this.inner.findBySlug(slug);
    if (product) await this.writeCache(product);
    return product;
  }

  async list(filter: ProductListFilter, page: ProductListCursor): Promise<ProductListPage> {
    return this.inner.list(filter, page);
  }

  async save(product: Product, outboxEvents?: OutboxAppend[]): Promise<Product> {
    const saved = await this.inner.save(product, outboxEvents);
    await this.evict(saved.id, saved.slug);
    return saved;
  }

  async saveMetadata(product: Product, outboxEvents?: OutboxAppend[]): Promise<Product> {
    const saved = await this.inner.saveMetadata(product, outboxEvents);
    await this.evict(saved.id, saved.slug);
    return saved;
  }

  async delete(id: string, outboxEvents?: OutboxAppend[]): Promise<void> {
    // Look up the slug before deleting so its cache key can be evicted too;
    // go straight to the inner repo to avoid re-populating the cache mid-delete.
    const existing = await this.inner.findById(id);
    await this.inner.delete(id, outboxEvents);
    await this.evict(id, existing?.slug);
  }

  private async readCache(key: string): Promise<Product | null> {
    try {
      const raw = await this.redis.client.get(key);
      return raw ? deserializeProduct(raw) : null;
    } catch (e) {
      this.logger.debug(`cache read miss-by-error for ${key}: ${(e as Error).message}`);
      return null;
    }
  }

  private async writeCache(product: Product): Promise<void> {
    const payload = serializeProduct(product);
    try {
      await this.redis.client
        .multi()
        .set(ID_KEY(product.id), payload, 'EX', this.ttlSeconds)
        .set(SLUG_KEY(product.slug), payload, 'EX', this.ttlSeconds)
        .exec();
    } catch (e) {
      this.logger.debug(`cache write skipped for ${product.id}: ${(e as Error).message}`);
    }
  }

  private async evict(id: string, slug?: string): Promise<void> {
    const keys = slug ? [ID_KEY(id), SLUG_KEY(slug)] : [ID_KEY(id)];
    try {
      await this.redis.client.del(...keys);
    } catch (e) {
      this.logger.debug(`cache evict skipped for ${id}: ${(e as Error).message}`);
    }
  }
}
