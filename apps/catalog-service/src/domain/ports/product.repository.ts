import type { Product } from '../product.entity.js';
import type { OutboxAppend } from './outbox.repository.js';

export interface ProductListFilter {
  categoryId?: string;
  isActive?: boolean;
  search?: string;
}

export interface ProductListCursor {
  limit: number;
  cursor?: string;
}

export interface ProductListPage {
  items: Product[];
  nextCursor: string | null;
}

/**
 * `save` and `delete` accept optional outbox events that MUST be persisted in
 * the same DB transaction as the aggregate change — the transactional outbox
 * boundary: the use case decides which events to emit, the adapter guarantees
 * atomicity.
 */
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findBySlug(slug: string): Promise<Product | null>;
  list(filter: ProductListFilter, page: ProductListCursor): Promise<ProductListPage>;
  /**
   * Upserts product + SKUs + prices with per-row diff: SKUs missing from the
   * new aggregate are deleted, present SKUs are updated, new ones inserted.
   * Inventory rows for unchanged SKUs are preserved (no FK cascade).
   */
  save(product: Product, outboxEvents?: OutboxAppend[]): Promise<Product>;
  /**
   * Updates only product columns (name, description, slug, images, isActive,
   * categoryId). Does NOT touch SKUs or prices, so inventory survives.
   */
  saveMetadata(product: Product, outboxEvents?: OutboxAppend[]): Promise<Product>;
  delete(id: string, outboxEvents?: OutboxAppend[]): Promise<void>;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
