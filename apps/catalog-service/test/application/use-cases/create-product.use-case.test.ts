import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { CreateProductUseCase } from '../../../src/application/use-cases/create-product.use-case.js';
import { InMemoryProductRepository } from '../../fakes/in-memory-product.repository.js';
import { InMemoryOutboxRepository } from '../../fakes/in-memory-outbox.repository.js';
import { InMemoryCategoryRepository } from '../../fakes/in-memory-category.repository.js';
import { InMemoryInventoryRepository } from '../../fakes/in-memory-inventory.repository.js';
import { Category } from '../../../src/domain/category.entity.js';
import { isErr, isOk } from '../../../src/domain/common/result.js';
import { ROUTING_KEYS } from '@jcool/contracts';

const CAT_ID = '22222222-2222-2222-2222-222222222222';

const makeSut = () => {
  const outbox = new InMemoryOutboxRepository();
  const products = new InMemoryProductRepository(outbox);
  const categories = new InMemoryCategoryRepository();
  const inventory = new InMemoryInventoryRepository();
  categories.seed(Category.rehydrate({ id: CAT_ID, slug: 'apparel', name: 'Apparel' }));
  const sut = new CreateProductUseCase(products, categories, inventory);
  return { sut, products, outbox, inventory };
};

const validInput = () => ({
  slug: `tee-${randomUUID().slice(0, 6)}`,
  name: 'Red Tee',
  description: 'Soft cotton tee',
  categoryId: CAT_ID,
  images: ['https://cdn.example/red-tee.jpg'],
  isActive: true,
  skus: [
    {
      sku: 'TS-RED-M',
      attributes: { color: 'red', size: 'M' },
      prices: [
        { currency: 'USD' as const, unitAmount: 1999 },
        { currency: 'VND' as const, unitAmount: 499000 },
      ],
      initialStock: 50,
    },
  ],
});

describe('CreateProductUseCase', () => {
  it('persists product, seeds inventory, appends product.indexed event', async () => {
    const { sut, products, outbox, inventory } = makeSut();

    const result = await sut.execute(validInput());

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const saved = await products.findById(result.value.id);
    expect(saved).not.toBeNull();
    expect(saved?.skus).toHaveLength(1);

    const events = outbox.byRoutingKey(ROUTING_KEYS.PRODUCT_INDEXED);
    expect(events).toHaveLength(1);
    const payload = events[0]?.payload as { productId: string; action: string };
    expect(payload.productId).toBe(result.value.id);
    expect(payload.action).toBe('UPSERT');

    const inv = await inventory.findBySkuId(result.value.skus[0]!.id);
    expect(inv?.available).toBe(50);
  });

  it('rejects when category does not exist', async () => {
    const { sut } = makeSut();
    const input = validInput();
    input.categoryId = randomUUID();

    const result = await sut.execute(input);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('CATEGORY_NOT_FOUND');
  });

  it('rejects when SKU is missing default-currency price', async () => {
    const { sut } = makeSut();
    const input = validInput();
    input.skus[0]!.prices = [{ currency: 'VND' as const, unitAmount: 499000 }];

    const result = await sut.execute(input);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('SKU_MISSING_DEFAULT_CURRENCY_PRICE');
  });
});
