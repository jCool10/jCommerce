import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ReserveInventoryUseCase } from '../../../src/application/use-cases/reserve-inventory.use-case.js';
import { InMemoryInventoryRepository } from '../../fakes/in-memory-inventory.repository.js';
import { isErr, isOk } from '../../../src/domain/common/result.js';

const SKU_A = '00000000-0000-0000-0000-0000000000aa';
const SKU_B = '00000000-0000-0000-0000-0000000000bb';

const makeSut = () => {
  const inventory = new InMemoryInventoryRepository();
  const sut = new ReserveInventoryUseCase(inventory);
  return { sut, inventory };
};

describe('ReserveInventoryUseCase', () => {
  it('reserves single sku when stock is sufficient', async () => {
    const { sut, inventory } = makeSut();
    inventory.seed(SKU_A, 10);

    const result = await sut.execute({
      orderId: randomUUID(),
      items: [{ skuId: SKU_A, quantity: 3 }],
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.reservedSkuIds).toEqual([SKU_A]);
    }
    const inv = await inventory.findBySkuId(SKU_A);
    expect(inv?.available).toBe(7);
    expect(inv?.reserved).toBe(3);
  });

  it('fails atomically when ANY sku has insufficient stock (no partial reserves)', async () => {
    const { sut, inventory } = makeSut();
    inventory.seed(SKU_A, 10);
    inventory.seed(SKU_B, 1);

    const result = await sut.execute({
      orderId: randomUUID(),
      items: [
        { skuId: SKU_A, quantity: 3 },
        { skuId: SKU_B, quantity: 5 },
      ],
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe('INSUFFICIENT_STOCK');
    }

    // No state mutation
    expect((await inventory.findBySkuId(SKU_A))?.available).toBe(10);
    expect((await inventory.findBySkuId(SKU_B))?.available).toBe(1);
  });

  it('prevents overselling under concurrent reservation attempts', async () => {
    const { sut, inventory } = makeSut();
    // Stock = 5 — 10 concurrent reservations of 1 unit each.
    inventory.seed(SKU_A, 5);

    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        sut.execute({
          orderId: randomUUID(),
          items: [{ skuId: SKU_A, quantity: 1 }],
        }),
      ),
    );

    const successes = attempts.filter(isOk);
    const failures = attempts.filter(isErr);

    expect(successes).toHaveLength(5);
    expect(failures).toHaveLength(5);

    const inv = await inventory.findBySkuId(SKU_A);
    expect(inv?.available).toBe(0);
    expect(inv?.reserved).toBe(5);
  });

  it('is idempotent: same orderId returns prior outcome without re-reserving', async () => {
    const { sut, inventory } = makeSut();
    inventory.seed(SKU_A, 10);
    const orderId = randomUUID();

    const first = await sut.execute({
      orderId,
      items: [{ skuId: SKU_A, quantity: 4 }],
    });
    const second = await sut.execute({
      orderId,
      items: [{ skuId: SKU_A, quantity: 4 }],
    });

    expect(isOk(first)).toBe(true);
    expect(isOk(second)).toBe(true);

    const inv = await inventory.findBySkuId(SKU_A);
    expect(inv?.available).toBe(6); // not 2
    expect(inv?.reserved).toBe(4);
  });
});
