import { randomUUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { Category } from '../../domain/category.entity.js';
import type { CategoryRepository } from '../../domain/ports/category.repository.js';
import type { InventoryRepository } from '../../domain/ports/inventory.repository.js';
import { CreateProductUseCase } from './create-product.use-case.js';
import { isErr } from '../../domain/common/result.js';

export interface SeedCatalogInput {
  productCount?: number;
}

// V2/V4: 150-200 products across 5-7 categories with dual-currency prices.
const CATEGORIES: Array<{ slug: string; name: string }> = [
  { slug: 'electronics', name: 'Electronics' },
  { slug: 'apparel', name: 'Apparel' },
  { slug: 'books', name: 'Books' },
  { slug: 'home', name: 'Home' },
  { slug: 'sports', name: 'Sports' },
  { slug: 'beauty', name: 'Beauty' },
  { slug: 'toys', name: 'Toys' },
];

const VND_PER_USD = 25000;

export interface SeedCatalogReport {
  categoriesCreated: number;
  productsCreated: number;
  skusCreated: number;
  failures: number;
}

export class SeedCatalogUseCase {
  constructor(
    private readonly categories: CategoryRepository,
    // Inventory is wired here for future bulk-restock scenarios. Today,
    // CreateProductUseCase seeds inventory per SKU.
    private readonly _inventory: InventoryRepository,
    private readonly createProduct: CreateProductUseCase,
  ) {}

  async execute(input: SeedCatalogInput = {}): Promise<SeedCatalogReport> {
    const productCount = input.productCount ?? 180;
    faker.seed(42); // deterministic seed runs

    let categoriesCreated = 0;
    const categoryIds: string[] = [];
    for (const c of CATEGORIES) {
      const existing = await this.categories.findBySlug(c.slug);
      if (existing) {
        categoryIds.push(existing.id);
        continue;
      }
      const created = await this.categories.upsert(
        Category.rehydrate({ id: randomUUID(), slug: c.slug, name: c.name }),
      );
      categoryIds.push(created.id);
      categoriesCreated += 1;
    }

    let productsCreated = 0;
    let skusCreated = 0;
    let failures = 0;

    for (let i = 0; i < productCount; i++) {
      const skuCount = faker.number.int({ min: 1, max: 3 });
      const baseUsd = faker.number.int({ min: 500, max: 50000 }); // cents = $5 – $500
      const skus = Array.from({ length: skuCount }, (_, idx) => {
        const variantUsd = baseUsd + idx * 100;
        return {
          sku: `SKU-${faker.string.alphanumeric({ length: 8, casing: 'upper' })}`,
          attributes: {
            color: faker.color.human(),
            size: faker.helpers.arrayElement(['S', 'M', 'L', 'XL']),
          },
          prices: [
            { currency: 'USD' as const, unitAmount: variantUsd },
            {
              currency: 'VND' as const,
              unitAmount: Math.round((variantUsd / 100) * VND_PER_USD * 1000) / 1000,
            },
          ],
          initialStock: faker.number.int({ min: 10, max: 200 }),
        };
      });

      const result = await this.createProduct.execute({
        slug: `${faker.commerce.productAdjective().toLowerCase()}-${faker.commerce
          .product()
          .toLowerCase()}-${i}`,
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        categoryId: faker.helpers.arrayElement(categoryIds),
        images: [faker.image.urlPicsumPhotos({ width: 600, height: 600 })],
        isActive: true,
        skus,
      });

      if (isErr(result)) {
        failures += 1;
        continue;
      }
      productsCreated += 1;
      skusCreated += result.value.skus.length;
    }

    return { categoriesCreated, productsCreated, skusCreated, failures };
  }
}
