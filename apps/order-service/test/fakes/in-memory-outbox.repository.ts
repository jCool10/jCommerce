import { randomUUID } from 'node:crypto';
import type {
  OutboxRecord,
  OutboxRepository,
} from '../../src/domain/ports/outbox.repository.js';

/**
 * In-memory OutboxRepository fake for unit tests.
 *
 * drainBatch mirrors the real FOR UPDATE SKIP LOCKED contract:
 * publishFn failures leave the record unpublished; successfully-published
 * rows are not re-delivered on subsequent drain calls.
 */
export class InMemoryOutboxRepository implements OutboxRepository {
  // Exposed for direct seeding in tests
  readonly records: OutboxRecord[] = [];

  seed(routingKey: string, payload: unknown = {}): this {
    this.records.push({
      id: randomUUID(),
      routingKey,
      payload,
      createdAt: new Date(Date.now() + this.records.length), // deterministic order
      publishedAt: null,
    });
    return this;
  }

  async fetchUnpublished(limit: number): Promise<OutboxRecord[]> {
    return this.records.filter((r) => r.publishedAt === null).slice(0, limit);
  }

  async markPublished(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    for (const r of this.records) {
      if (idSet.has(r.id)) r.publishedAt = new Date();
    }
  }

  async countStuck(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    return this.records.filter(
      (r) => r.publishedAt === null && r.createdAt.getTime() < cutoff,
    ).length;
  }

  /**
   * In-memory equivalent of the SKIP LOCKED drain transaction.
   * publishFn failures leave the row unpublished — mirrors real contract.
   */
  async drainBatch(
    limit: number,
    publishFn: (record: OutboxRecord) => Promise<void>,
  ): Promise<{ total: number; published: number }> {
    const batch = this.records.filter((r) => r.publishedAt === null).slice(0, limit);
    if (batch.length === 0) return { total: 0, published: 0 };

    let published = 0;
    for (const record of batch) {
      try {
        await publishFn(record);
        record.publishedAt = new Date();
        published++;
      } catch {
        // leave unpublished — mirrors real drainBatch contract
      }
    }
    return { total: batch.length, published };
  }
}
