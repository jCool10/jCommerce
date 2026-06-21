import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ReserveInventoryUseCase } from '../../../src/application/use-cases/reserve-inventory.use-case.js';
import { ReleaseInventoryUseCase } from '../../../src/application/use-cases/release-inventory.use-case.js';
import { InMemoryInventoryRepository } from '../../fakes/in-memory-inventory.repository.js';
import { isOk } from '../../../src/domain/common/result.js';

const SKU = '00000000-0000-0000-0000-0000000000aa';

describe('ReleaseInventoryUseCase', () => {
  it('releases reserved stock back to available', async () => {
    const inventory = new InMemoryInventoryRepository();
    inventory.seed(SKU, 10);
    const reserve = new ReserveInventoryUseCase(inventory);
    const release = new ReleaseInventoryUseCase(inventory);
    const orderId = randomUUID();

    await reserve.execute({ orderId, items: [{ skuId: SKU, quantity: 4 }] });
    const result = await release.execute({ orderId });

    expect(isOk(result)).toBe(true);
    const inv = await inventory.findBySkuId(SKU);
    expect(inv?.available).toBe(10);
    expect(inv?.reserved).toBe(0);
  });

  it('is idempotent: releasing an unknown order succeeds without changes', async () => {
    const inventory = new InMemoryInventoryRepository();
    inventory.seed(SKU, 10);
    const release = new ReleaseInventoryUseCase(inventory);

    const result = await release.execute({ orderId: randomUUID() });

    expect(isOk(result)).toBe(true);
    const inv = await inventory.findBySkuId(SKU);
    expect(inv?.available).toBe(10);
  });
});
