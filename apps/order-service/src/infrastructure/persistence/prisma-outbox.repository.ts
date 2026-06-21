import { Injectable } from '@nestjs/common';
import type {
  OutboxRecord,
  OutboxRepository,
} from '../../domain/ports/outbox.repository.js';
import { PrismaService } from './prisma.service.js';

/** Raw row shape returned by the SKIP LOCKED query. */
interface OutboxRow {
  id: string;
  routing_key: string;
  payload: unknown;
  created_at: Date;
  published_at: Date | null;
}

@Injectable()
export class PrismaOutboxRepository implements OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async fetchUnpublished(limit: number): Promise<OutboxRecord[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      routingKey: r.routingKey,
      payload: r.payload as unknown,
      createdAt: r.createdAt,
      publishedAt: r.publishedAt,
    }));
  }

  async markPublished(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: { publishedAt: new Date() },
    });
  }

  async countStuck(olderThanMs: number): Promise<number> {
    return this.prisma.outboxEvent.count({
      where: {
        publishedAt: null,
        createdAt: { lt: new Date(Date.now() - olderThanMs) },
      },
    });
  }

  /**
   * Atomically drain up to `limit` unpublished rows in a single transaction.
   *
   * FOR UPDATE SKIP LOCKED ensures concurrent replicas claim disjoint row sets —
   * each replica locks its batch and skips rows already locked by peers, so no
   * row is delivered more than once even under horizontal scaling.
   *
   * Flow: lock rows → call publishFn per row (failures tracked, not thrown) →
   * mark successfully-published rows → commit (releases locks).
   * On transaction failure the locks are released and rows retry on next tick.
   */
  async drainBatch(
    limit: number,
    publishFn: (record: OutboxRecord) => Promise<void>,
  ): Promise<{ total: number; published: number }> {
    return this.prisma.$transaction(async (tx) => {
      // Raw query required — Prisma ORM does not expose FOR UPDATE SKIP LOCKED.
      const rows = await tx.$queryRaw<OutboxRow[]>`
        SELECT id, routing_key, payload, created_at, published_at
        FROM outbox_events
        WHERE published_at IS NULL
        ORDER BY created_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;

      if (rows.length === 0) return { total: 0, published: 0 };

      const records: OutboxRecord[] = rows.map((r) => ({
        id: r.id,
        routingKey: r.routing_key,
        payload: r.payload,
        createdAt: r.created_at,
        publishedAt: r.published_at,
      }));

      const published: string[] = [];
      for (const record of records) {
        try {
          await publishFn(record);
          published.push(record.id);
        } catch {
          // Publish failure: leave publishedAt null; next tick will retry.
          // The transaction still commits — successfully-published rows are marked.
        }
      }

      if (published.length > 0) {
        const now = new Date();
        await tx.outboxEvent.updateMany({
          where: { id: { in: published } },
          data: { publishedAt: now },
        });
      }

      return { total: records.length, published: published.length };
    });
  }
}
