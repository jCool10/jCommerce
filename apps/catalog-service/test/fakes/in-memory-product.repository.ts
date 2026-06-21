import type { Product } from '../../src/domain/product.entity.js';
import type {
  ProductListCursor,
  ProductListFilter,
  ProductListPage,
  ProductRepository,
} from '../../src/domain/ports/product.repository.js';
import type { OutboxAppend } from '../../src/domain/ports/outbox.repository.js';
import type { InMemoryOutboxRepository } from './in-memory-outbox.repository.js';

export class InMemoryProductRepository implements ProductRepository {
  private readonly byId = new Map<string, Product>();

  constructor(private readonly outbox: InMemoryOutboxRepository) {}

  async findById(id: string): Promise<Product | null> {
    return this.byId.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    for (const p of this.byId.values()) if (p.slug === slug) return p;
    return null;
  }

  async list(filter: ProductListFilter, page: ProductListCursor): Promise<ProductListPage> {
    const all = [...this.byId.values()].filter((p) => {
      if (filter.categoryId && p.categoryId !== filter.categoryId) return false;
      if (filter.isActive !== undefined && p.isActive !== filter.isActive) return false;
      if (filter.search && !p.name.toLowerCase().includes(filter.search.toLowerCase()))
        return false;
      return true;
    });

    const sorted = all.sort((a, b) => a.id.localeCompare(b.id));
    const startIdx = page.cursor ? sorted.findIndex((p) => p.id === page.cursor) + 1 : 0;
    const slice = sorted.slice(startIdx, startIdx + page.limit);
    const nextCursor =
      startIdx + page.limit < sorted.length ? (slice.at(-1)?.id ?? null) : null;

    return { items: slice, nextCursor };
  }

  async save(product: Product, outboxEvents: OutboxAppend[] = []): Promise<Product> {
    this.byId.set(product.id, product);
    for (const ev of outboxEvents) await this.outbox.append(ev);
    return product;
  }

  async saveMetadata(product: Product, outboxEvents: OutboxAppend[] = []): Promise<Product> {
    this.byId.set(product.id, product);
    for (const ev of outboxEvents) await this.outbox.append(ev);
    return product;
  }

  async delete(id: string, outboxEvents: OutboxAppend[] = []): Promise<void> {
    this.byId.delete(id);
    for (const ev of outboxEvents) await this.outbox.append(ev);
  }

  // test helper
  size(): number {
    return this.byId.size;
  }
}
