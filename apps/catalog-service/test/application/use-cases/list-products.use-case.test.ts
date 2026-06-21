import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ListProductsUseCase } from '../../../src/application/use-cases/list-products.use-case.js';
import { CreateProductUseCase } from '../../../src/application/use-cases/create-product.use-case.js';
import { InMemoryProductRepository } from '../../fakes/in-memory-product.repository.js';
import { InMemoryOutboxRepository } from '../../fakes/in-memory-outbox.repository.js';
import { InMemoryCategoryRepository } from '../../fakes/in-memory-category.repository.js';
import { InMemoryInventoryRepository } from '../../fakes/in-memory-inventory.repository.js';
import { Category } from '../../../src/domain/category.entity.js';
import { isOk } from '../../../src/domain/common/result.js';

const CAT_ID = '22222222-2222-2222-2222-222222222222';

const buildSuite = async () => {
  const outbox = new InMemoryOutboxRepository();
  const products = new InMemoryProductRepository(outbox);
  const categories = new InMemoryCategoryRepository();
  const inventory = new InMemoryInventoryRepository();
  categories.seed(Category.rehydrate({ id: CAT_ID, slug: 'apparel', name: 'Apparel' }));
  const create = new CreateProductUseCase(products, categories, inventory);
  for (let i = 0; i < 5; i++) {
    await create.execute({
      slug: `tee-${i}-${randomUUID().slice(0, 4)}`,
      name: `Tee ${i}`,
      description: 'd',
      categoryId: CAT_ID,
      images: [],
      isActive: true,
      skus: [
        {
          sku: `TS-${i}`,
          attributes: {},
          prices: [
            { currency: 'USD' as const, unitAmount: 1000 + i },
            { currency: 'VND' as const, unitAmount: 250000 + i * 1000 },
          ],
          initialStock: 10,
        },
      ],
    });
  }
  const list = new ListProductsUseCase(products, inventory);
  return { list, products, inventory };
};

describe('ListProductsUseCase', () => {
  it('returns the first page with currency-stripped prices', async () => {
    const { list } = await buildSuite();

    const result = await list.execute({ limit: 3, currency: 'USD' });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.items).toHaveLength(3);
    expect(result.value.nextCursor).not.toBeNull();
    for (const p of result.value.items) {
      for (const sku of p.skus) {
        // Only the requested currency is exposed to the client
        expect(sku.prices).toHaveLength(1);
        expect(sku.prices[0]!.currency).toBe('USD');
      }
    }
  });

  it('paginates using the cursor', async () => {
    const { list } = await buildSuite();

    const first = await list.execute({ limit: 3, currency: 'USD' });
    if (!isOk(first) || !first.value.nextCursor) throw new Error('expected cursor');

    const second = await list.execute({
      limit: 3,
      currency: 'USD',
      cursor: first.value.nextCursor,
    });

    expect(isOk(second)).toBe(true);
    if (!isOk(second)) return;
    expect(second.value.items).toHaveLength(2);
    expect(second.value.nextCursor).toBeNull();
  });
});
