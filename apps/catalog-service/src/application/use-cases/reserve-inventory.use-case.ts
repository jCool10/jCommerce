import { err, ok, type Result } from '../../domain/common/result.js';
import type { CatalogError } from '../../domain/catalog-error.js';
import type { InventoryRepository } from '../../domain/ports/inventory.repository.js';

export interface ReserveInventoryInput {
  orderId: string;
  items: Array<{ skuId: string; quantity: number }>;
}

export interface ReserveInventorySuccess {
  reservedSkuIds: string[];
}

export class ReserveInventoryUseCase {
  constructor(private readonly inventory: InventoryRepository) {}

  async execute(
    input: ReserveInventoryInput,
  ): Promise<Result<ReserveInventorySuccess, CatalogError>> {
    if (input.items.length === 0) {
      return err({ kind: 'INVALID_QUANTITY', reason: 'NON_POSITIVE' });
    }

    const outcome = await this.inventory.reserveWithLock(input.orderId, input.items);

    if (outcome.insufficientStock.length > 0) {
      const first = outcome.insufficientStock[0]!;
      return err({
        kind: 'INSUFFICIENT_STOCK',
        skuId: first.skuId,
        requested: first.requested,
        available: first.available,
      });
    }
    return ok({ reservedSkuIds: outcome.reservedSkuIds });
  }
}
