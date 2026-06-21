import { Category } from '../../src/domain/category.entity.js';
import type { CategoryRepository } from '../../src/domain/ports/category.repository.js';

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly byId = new Map<string, Category>();

  seed(category: Category): void {
    this.byId.set(category.id, category);
  }

  async findById(id: string): Promise<Category | null> {
    return this.byId.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    for (const c of this.byId.values()) if (c.slug === slug) return c;
    return null;
  }

  async list(): Promise<Category[]> {
    return [...this.byId.values()];
  }

  async upsert(category: Category): Promise<Category> {
    this.byId.set(category.id, category);
    return category;
  }
}
