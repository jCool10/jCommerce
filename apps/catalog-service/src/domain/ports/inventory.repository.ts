import type { Inventory } from '../inventory.entity.js';

export interface ReserveLine {
  skuId: string;
  quantity: number;
}

export interface ReservationOutcome {
  reservedSkuIds: string[];
  insufficientStock: Array<{ skuId: string; requested: number; available: number }>;
}

/**
 * Repository for inventory aggregate. The atomic multi-SKU operation
 * `reserveWithLock` is the saga's hot path: it locks all SKUs in sorted
 * order (deadlock-free), checks availability, and persists the new
 * inventory + reservation rows in a single transaction.
 */
export interface InventoryRepository {
  findBySkuId(skuId: string): Promise<Inventory | null>;
  findBySkuIds(skuIds: string[]): Promise<Inventory[]>;
  upsertMany(records: Inventory[]): Promise<void>;
  reserveWithLock(orderId: string, lines: ReserveLine[]): Promise<ReservationOutcome>;
  releaseForOrder(orderId: string): Promise<void>;
}

export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');
