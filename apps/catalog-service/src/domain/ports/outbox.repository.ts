export interface OutboxRecord {
  id: string;
  routingKey: string;
  payload: unknown;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface OutboxAppend {
  routingKey: string;
  payload: unknown;
}

/**
 * Transactional outbox: `append` MUST run inside the same DB transaction as
 * the aggregate it accompanies. The Prisma adapter exposes a tx-scoped form
 * (`appendInTx`) for that; this port stays narrow for the cron.
 *
 * `drainBatch` is the horizontal-scaling-safe drain path: it runs
 * fetch + publishFn + mark-published atomically in one DB transaction.
 * The underlying query uses FOR UPDATE SKIP LOCKED so concurrent replicas
 * claim disjoint rows and never double-publish.
 *
 * `publishFn` is called per record inside the transaction. If `publishFn`
 * throws, the record id is omitted from markPublished (not marked); if the
 * entire transaction is rolled back, all locks are released for the next tick.
 */
export interface OutboxRepository {
  fetchUnpublished(limit: number): Promise<OutboxRecord[]>;
  markPublished(ids: string[]): Promise<void>;
  countStuck(olderThanMs: number): Promise<number>;
  drainBatch(
    limit: number,
    publishFn: (record: OutboxRecord) => Promise<void>,
  ): Promise<{ total: number; published: number }>;
}

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');
