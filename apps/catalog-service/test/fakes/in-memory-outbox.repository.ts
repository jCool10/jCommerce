import { randomUUID } from 'node:crypto';
import type {
  OutboxAppend,
  OutboxRecord,
  OutboxRepository,
} from '../../src/domain/ports/outbox.repository.js';

export class InMemoryOutboxRepository implements OutboxRepository {
  private readonly records: OutboxRecord[] = [];

  async append(input: OutboxAppend): Promise<void> {
    this.records.push({
      id: randomUUID(),
      routingKey: input.routingKey,
      payload: input.payload,
      createdAt: new Date(),
      publishedAt: null,
    });
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
   * In-memory equivalent of the SKIP LOCKED drain: sequential claim simulation.
   * No actual row locking (single-process), but mirrors the real contract —
   * publishFn failures leave the record unpublished for next tick.
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

  // test helpers
  all(): OutboxRecord[] {
    return [...this.records];
  }

  byRoutingKey(routingKey: string): OutboxRecord[] {
    return this.records.filter((r) => r.routingKey === routingKey);
  }
}
