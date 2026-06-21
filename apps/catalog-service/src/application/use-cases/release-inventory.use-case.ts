import { ok, type Result } from '../../domain/common/result.js';
import type { CatalogError } from '../../domain/catalog-error.js';
import type { InventoryRepository } from '../../domain/ports/inventory.repository.js';

export interface ReleaseInventoryInput {
  orderId: string;
}

export class ReleaseInventoryUseCase {
  constructor(private readonly inventory: InventoryRepository) {}

  async execute(input: ReleaseInventoryInput): Promise<Result<{ released: true }, CatalogError>> {
    await this.inventory.releaseForOrder(input.orderId);
    return ok({ released: true });
  }
}
