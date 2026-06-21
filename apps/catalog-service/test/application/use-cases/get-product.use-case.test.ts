import { describe, expect, it } from 'vitest';
import { GetProductUseCase } from '../../../src/application/use-cases/get-product.use-case.js';
import { CreateProductUseCase } from '../../../src/application/use-cases/create-product.use-case.js';
import { UpdateProductUseCase } from '../../../src/application/use-cases/update-product.use-case.js';
import { InMemoryProductRepository } from '../../fakes/in-memory-product.repository.js';
import { InMemoryOutboxRepository } from '../../fakes/in-memory-outbox.repository.js';
import { InMemoryCategoryRepository } from '../../fakes/in-memory-category.repository.js';
import { InMemoryInventoryRepository } from '../../fakes/in-memory-inventory.repository.js';
import { Category } from '../../../src/domain/category.entity.js';
import { isErr, isOk } from '../../../src/domain/common/result.js';

const CAT_ID = '22222222-2222-2222-2222-222222222222';

const buildSuite = async () => {
  const outbox = new InMemoryOutboxRepository();
  const products = new InMemoryProductRepository(outbox);
  const categories = new InMemoryCategoryRepository();
  const inventory = new InMemoryInventoryRepository();
  categories.seed(Category.rehydrate({ id: CAT_ID, slug: 'apparel', name: 'Apparel' }));
  const create = new CreateProductUseCase(products, categories, inventory);
  const update = new UpdateProductUseCase(products, categories);
  const get = new GetProductUseCase(products, inventory);
  return { create, update, get };
};

describe('GetProductUseCase', () => {
  it('returns the product when active', async () => {
    const { create, get } = await buildSuite();
    const created = await create.execute({
      slug: 'tee-active',
      name: 'Tee Active',
      description: 'd',
      categoryId: CAT_ID,
      images: [],
      isActive: true,
      skus: [
        {
          sku: 'TS-1',
          attributes: {},
          prices: [{ currency: 'USD', unitAmount: 1000 }],
          initialStock: 10,
        },
      ],
    });
    expect(isOk(created)).toBe(true);
    if (!isOk(created)) return;

    const result = await get.execute({ productId: created.value.id, currency: 'USD' });

    expect(isOk(result)).toBe(true);
  });

  it('hides inactive product from public callers (404)', async () => {
    const { create, update, get } = await buildSuite();
    const created = await create.execute({
      slug: 'tee-inactive',
      name: 'Tee Inactive',
      description: 'd',
      categoryId: CAT_ID,
      images: [],
      isActive: true,
      skus: [
        {
          sku: 'TS-2',
          attributes: {},
          prices: [{ currency: 'USD', unitAmount: 1000 }],
          initialStock: 10,
        },
      ],
    });
    if (!isOk(created)) throw new Error('seed failed');
    await update.execute({ productId: created.value.id, isActive: false });

    const result = await get.execute({ productId: created.value.id, currency: 'USD' });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe('PRODUCT_NOT_FOUND');
    }
  });

  it('returns inactive product when includeInactive=true (admin escape hatch)', async () => {
    const { create, update, get } = await buildSuite();
    const created = await create.execute({
      slug: 'tee-admin-view',
      name: 'Tee Admin View',
      description: 'd',
      categoryId: CAT_ID,
      images: [],
      isActive: true,
      skus: [
        {
          sku: 'TS-3',
          attributes: {},
          prices: [{ currency: 'USD', unitAmount: 1000 }],
          initialStock: 10,
        },
      ],
    });
    if (!isOk(created)) throw new Error('seed failed');
    await update.execute({ productId: created.value.id, isActive: false });

    const result = await get.execute({
      productId: created.value.id,
      currency: 'USD',
      includeInactive: true,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.isActive).toBe(false);
    }
  });
});
