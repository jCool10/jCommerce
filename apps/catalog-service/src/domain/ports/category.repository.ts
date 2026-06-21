import type { Category } from '../category.entity.js';

export interface CategoryRepository {
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  list(): Promise<Category[]>;
  upsert(category: Category): Promise<Category>;
}

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
