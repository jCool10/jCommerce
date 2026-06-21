import { err, ok, type Result } from './common/result.js';
import type { CatalogError } from './catalog-error.js';

export interface InventoryProps {
  skuId: string;
  available: number;
  reserved: number;
}

/**
 * Aggregate root for stock state of a single SKU.
 *
 * Invariants:
 *  - `available` and `reserved` are non-negative integers
 *  - Reserving N moves N units from `available` → `reserved`
 *  - Releasing N moves N units from `reserved` → `available`
 *
 * Mutating methods return Result so callers handle insufficient stock
 * without exception-driven control flow. Concurrency safety is the
 * repository's responsibility (SELECT FOR UPDATE), not the entity's.
 */
export class Inventory {
  private constructor(private state: InventoryProps) {}

  get skuId(): string {
    return this.state.skuId;
  }
  get available(): number {
    return this.state.available;
  }
  get reserved(): number {
    return this.state.reserved;
  }

  static rehydrate(state: InventoryProps): Inventory {
    return new Inventory({ ...state });
  }

  reserve(quantity: number): Result<void, CatalogError> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return err({ kind: 'INVALID_QUANTITY', reason: 'NON_POSITIVE' });
    }
    if (quantity > this.state.available) {
      return err({
        kind: 'INSUFFICIENT_STOCK',
        skuId: this.state.skuId,
        requested: quantity,
        available: this.state.available,
      });
    }
    this.state = {
      ...this.state,
      available: this.state.available - quantity,
      reserved: this.state.reserved + quantity,
    };
    return ok(undefined);
  }

  release(quantity: number): Result<void, CatalogError> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return err({ kind: 'INVALID_QUANTITY', reason: 'NON_POSITIVE' });
    }
    if (quantity > this.state.reserved) {
      return err({
        kind: 'OVER_RELEASE',
        skuId: this.state.skuId,
        requested: quantity,
        reserved: this.state.reserved,
      });
    }
    this.state = {
      ...this.state,
      available: this.state.available + quantity,
      reserved: this.state.reserved - quantity,
    };
    return ok(undefined);
  }

  restock(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) return;
    this.state = { ...this.state, available: this.state.available + quantity };
  }

  toJSON(): InventoryProps {
    return { ...this.state };
  }
}
