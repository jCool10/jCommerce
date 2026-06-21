import { Injectable } from '@nestjs/common';
import { Category } from '../../domain/category.entity.js';
import type { CategoryRepository } from '../../domain/ports/category.repository.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { id } });
    return row ? Category.rehydrate({ id: row.id, slug: row.slug, name: row.name }) : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { slug } });
    return row ? Category.rehydrate({ id: row.id, slug: row.slug, name: row.name }) : null;
  }

  async list(): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    return rows.map((r) => Category.rehydrate({ id: r.id, slug: r.slug, name: r.name }));
  }

  async upsert(category: Category): Promise<Category> {
    const row = await this.prisma.category.upsert({
      where: { id: category.id },
      update: { name: category.name, slug: category.slug },
      create: { id: category.id, slug: category.slug, name: category.name },
    });
    return Category.rehydrate({ id: row.id, slug: row.slug, name: row.name });
  }
}
