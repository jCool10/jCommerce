/**
 * Unit tests for order-service InMemoryOutboxRepository.drainBatch.
 *
 * These tests verify the drain-batch contract without a real database.
 * The in-memory fake mirrors the real FOR UPDATE SKIP LOCKED semantics:
 * concurrent callers must not deliver the same record twice.
 *
 * For a true SKIP LOCKED integration test against Postgres, use Testcontainers
 * (pending phase 13). Manual repro: run two order-service dev shells pointing
 * at the same DB and observe poller logs — each instance should claim a
 * disjoint set of rows per tick with no duplicate events downstream.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryOutboxRepository } from '../fakes/in-memory-outbox.repository.js';

describe('InMemoryOutboxRepository (order-service) — drainBatch', () => {
  it('returns total=0 published=0 when no unpublished rows exist', async () => {
    const repo = new InMemoryOutboxRepository();
    const result = await repo.drainBatch(10, async () => {});
    expect(result).toEqual({ total: 0, published: 0 });
  });

  it('marks rows as published after successful publishFn', async () => {
    const repo = new InMemoryOutboxRepository()
      .seed('order.confirmed')
      .seed('payment.succeeded')
      .seed('order.confirmed');

    const delivered: string[] = [];
    const result = await repo.drainBatch(10, async (record) => {
      delivered.push(record.id);
    });

    expect(result).toEqual({ total: 3, published: 3 });
    expect(delivered).toHaveLength(3);
    expect(repo.records.every((r) => r.publishedAt !== null)).toBe(true);
  });

  it('leaves failed row unpublished while committing others', async () => {
    const repo = new InMemoryOutboxRepository()
      .seed('order.confirmed')
      .seed('payment.succeeded')
      .seed('order.cancelled');

    const failId = repo.records[1]!.id;

    const result = await repo.drainBatch(10, async (record) => {
      if (record.id === failId) throw new Error('broker unavailable');
    });

    expect(result).toEqual({ total: 3, published: 2 });
    expect(repo.records.find((r) => r.id === failId)!.publishedAt).toBeNull();
    expect(
      repo.records.filter((r) => r.id !== failId).every((r) => r.publishedAt !== null),
    ).toBe(true);
  });

  it('respects the batch size limit', async () => {
    const repo = new InMemoryOutboxRepository();
    for (let i = 0; i < 8; i++) repo.seed(`order.event.${i}`);

    const delivered: string[] = [];
    const result = await repo.drainBatch(5, async (record) => {
      delivered.push(record.id);
    });

    expect(result.total).toBe(5);
    expect(result.published).toBe(5);
    expect(repo.records.filter((r) => r.publishedAt === null)).toHaveLength(3);
  });

  it('sequential drain calls cover all rows without re-delivering published ones', async () => {
    // In-memory JS is single-threaded: true concurrent SKIP LOCKED isolation is
    // a Postgres-layer guarantee and cannot be replicated here without a real DB.
    // This test validates the SEQUENTIAL contract — once a row is published it
    // must never appear again in a subsequent drain, regardless of batch count.
    //
    // Manual Postgres repro: start two order-service replicas against the same
    // DB and grep logs for duplicate routing_keys — SKIP LOCKED ensures each
    // replica picks a disjoint batch per tick.
    const repo = new InMemoryOutboxRepository();
    for (let i = 0; i < 6; i++) repo.seed(`order.event.${i}`);

    const firstPass: string[] = [];
    const secondPass: string[] = [];

    const resultA = await repo.drainBatch(3, async (record) => {
      firstPass.push(record.id);
    });

    const resultB = await repo.drainBatch(3, async (record) => {
      secondPass.push(record.id);
    });

    // First pass claims 3 rows
    expect(resultA.total).toBe(3);
    expect(resultA.published).toBe(3);
    // Second pass picks up the remaining 3 (not already-published)
    expect(resultB.total).toBe(3);
    expect(resultB.published).toBe(3);
    // No overlap between the two passes
    const overlap = firstPass.filter((id) => secondPass.includes(id));
    expect(overlap).toHaveLength(0);
    // All 6 rows published
    expect(repo.records.every((r) => r.publishedAt !== null)).toBe(true);
  });

  it('does not re-deliver already-published rows on a second drain call', async () => {
    const repo = new InMemoryOutboxRepository()
      .seed('order.confirmed')
      .seed('payment.succeeded');

    const firstPass: string[] = [];
    const secondPass: string[] = [];

    await repo.drainBatch(10, async (r) => { firstPass.push(r.id); });
    await repo.drainBatch(10, async (r) => { secondPass.push(r.id); });

    expect(firstPass).toHaveLength(2);
    expect(secondPass).toHaveLength(0);
  });
});
