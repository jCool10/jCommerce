import { Inventory } from '../../src/domain/inventory.entity.js';
import type {
  InventoryRepository,
  ReservationOutcome,
  ReserveLine,
} from '../../src/domain/ports/inventory.repository.js';

/**
 * Single-threaded in-memory fake. `reserveWithLock` simulates the atomic
 * lock-then-check-then-mutate sequence the Postgres adapter implements via
 * SELECT FOR UPDATE; concurrency tests rely on JS' single-threaded event loop
 * to interleave `await` points (use `Promise.all` of `reserveWithLock` calls
 * and assert that only N succeed when stock = N).
 */
export class InMemoryInventoryRepository implements InventoryRepository {
  private readonly bySkuId = new Map<string, Inventory>();
  private readonly reservations = new Map<string, Array<{ skuId: string; quantity: number }>>();
  // Critical section serialization — mirrors a row-level lock.
  private lock: Promise<void> = Promise.resolve();

  seed(skuId: string, available: number, reserved = 0): void {
    this.bySkuId.set(skuId, Inventory.rehydrate({ skuId, available, reserved }));
  }

  async findBySkuId(skuId: string): Promise<Inventory | null> {
    const inv = this.bySkuId.get(skuId);
    return inv ? Inventory.rehydrate(inv.toJSON()) : null;
  }

  async findBySkuIds(skuIds: string[]): Promise<Inventory[]> {
    return skuIds
      .map((id) => this.bySkuId.get(id))
      .filter((v): v is Inventory => Boolean(v))
      .map((inv) => Inventory.rehydrate(inv.toJSON()));
  }

  async upsertMany(records: Inventory[]): Promise<void> {
    for (const r of records) this.bySkuId.set(r.skuId, r);
  }

  async reserveWithLock(orderId: string, lines: ReserveLine[]): Promise<ReservationOutcome> {
    return this.withLock(async () => {
      // Idempotency: if reservation for this orderId already exists, return prior outcome.
      if (this.reservations.has(orderId)) {
        const prior = this.reservations.get(orderId) ?? [];
        return {
          reservedSkuIds: prior.map((r) => r.skuId),
          insufficientStock: [],
        };
      }

      const sortedLines = [...lines].sort((a, b) => a.skuId.localeCompare(b.skuId));
      const insufficient: ReservationOutcome['insufficientStock'] = [];
      const reservedSkuIds: string[] = [];
      const mutated: Inventory[] = [];

      for (const line of sortedLines) {
        const stored =
          this.bySkuId.get(line.skuId) ??
          Inventory.rehydrate({ skuId: line.skuId, available: 0, reserved: 0 });
        // Clone first so a later-line failure leaves stored state untouched.
        const draft = Inventory.rehydrate(stored.toJSON());
        const result = draft.reserve(line.quantity);
        if (!result.ok) {
          if (result.error.kind === 'INSUFFICIENT_STOCK') {
            insufficient.push({
              skuId: line.skuId,
              requested: line.quantity,
              available: result.error.available,
            });
          } else {
            insufficient.push({
              skuId: line.skuId,
              requested: line.quantity,
              available: 0,
            });
          }
          continue;
        }
        mutated.push(draft);
        reservedSkuIds.push(line.skuId);
      }

      if (insufficient.length > 0) {
        // Atomic: don't persist partial reservations.
        return { reservedSkuIds: [], insufficientStock: insufficient };
      }

      for (const inv of mutated) this.bySkuId.set(inv.skuId, inv);
      this.reservations.set(
        orderId,
        sortedLines.map((l) => ({ skuId: l.skuId, quantity: l.quantity })),
      );
      return { reservedSkuIds, insufficientStock: [] };
    });
  }

  async releaseForOrder(orderId: string): Promise<void> {
    await this.withLock(async () => {
      const reserved = this.reservations.get(orderId);
      if (!reserved) return; // idempotent
      for (const line of reserved) {
        const inv = this.bySkuId.get(line.skuId);
        if (!inv) continue;
        inv.release(line.quantity);
      }
      this.reservations.delete(orderId);
    });
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prior = this.lock;
    let release: () => void = () => {};
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prior;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
