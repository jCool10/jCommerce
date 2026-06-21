/**
 * Unit tests for InMemoryOutboxRepository.drainBatch.
 *
 * These tests verify the drain-batch contract without a real database.
 * The in-memory fake mirrors the real FOR UPDATE SKIP LOCKED semantics:
 * concurrent callers must not deliver the same record twice.
 *
 * For a true SKIP LOCKED integration test against Postgres, use Testcontainers
 * (pending phase 13). Manual repro: run two catalog-service dev shells pointing
 * at the same DB and watch the poller logs — each instance should claim a
 * disjoint set of rows per tick with no "duplicate routing_key" in downstream
 * consumers.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InMemoryOutboxRepository } from '../fakes/in-memory-outbox.repository.js';

function makeRepo(count: number): InMemoryOutboxRepository {
  const repo = new InMemoryOutboxRepository();
  for (let i = 0; i < count; i++) {
    // Use the internal append helper via the public interface shape
    repo['records'].push({
      id: randomUUID(),
      routingKey: `test.event.${i}`,
      payload: { seq: i },
      createdAt: new Date(Date.now() + i), // staggered so ORDER BY created_at is deterministic
      publishedAt: null,
    });
  }
  return repo;
}

describe('InMemoryOutboxRepository — drainBatch', () => {
  it('returns total=0 published=0 when no unpublished rows exist', async () => {
    const repo = makeRepo(0);
    const result = await repo.drainBatch(10, async () => {});
    expect(result).toEqual({ total: 0, published: 0 });
  });

  it('marks rows as published after successful publishFn', async () => {
    const repo = makeRepo(3);
    const delivered: string[] = [];

    const result = await repo.drainBatch(10, async (record) => {
      delivered.push(record.id);
    });

    expect(result.total).toBe(3);
    expect(result.published).toBe(3);
    expect(delivered).toHaveLength(3);
    // All rows must now be marked published
    expect(repo.all().every((r) => r.publishedAt !== null)).toBe(true);
  });

  it('leaves a row unpublished when publishFn throws, but commits others', async () => {
    const repo = makeRepo(3);
    const allRecords = repo.all();
    const failId = allRecords[1]!.id;

    const result = await repo.drainBatch(10, async (record) => {
      if (record.id === failId) throw new Error('mq down');
    });

    expect(result.total).toBe(3);
    expect(result.published).toBe(2);

    const after = repo.all();
    const failedRow = after.find((r) => r.id === failId)!;
    expect(failedRow.publishedAt).toBeNull();

    const others = after.filter((r) => r.id !== failId);
    expect(others.every((r) => r.publishedAt !== null)).toBe(true);
  });

  it('respects the batch limit', async () => {
    const repo = makeRepo(10);
    const delivered: string[] = [];

    const result = await repo.drainBatch(4, async (record) => {
      delivered.push(record.id);
    });

    expect(result.total).toBe(4);
    expect(result.published).toBe(4);
    expect(delivered).toHaveLength(4);
    // 6 rows remain unpublished
    expect(repo.all().filter((r) => r.publishedAt === null)).toHaveLength(6);
  });

  it('sequential drain calls cover all rows without re-delivering published ones', async () => {
    // In-memory JS is single-threaded: true concurrent SKIP LOCKED isolation is
    // a Postgres-layer guarantee and cannot be replicated here without a real DB.
    // This test validates the SEQUENTIAL contract instead — the same invariant
    // that matters for retry correctness: once a row is published it must never
    // appear again, regardless of how many drain calls run after.
    //
    // Manual Postgres repro: start two catalog-service replicas against the same
    // DB and grep logs for duplicate routing_keys — SKIP LOCKED ensures each
    // replica picks a disjoint batch per tick.
    const repo = makeRepo(6);
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
    // Second pass picks up the remaining 3 (not the already-published ones)
    expect(resultB.total).toBe(3);
    expect(resultB.published).toBe(3);
    // No overlap between the two passes
    const overlap = firstPass.filter((id) => secondPass.includes(id));
    expect(overlap).toHaveLength(0);
    // All 6 rows published
    expect(repo.all().every((r) => r.publishedAt !== null)).toBe(true);
  });

  it('does not re-deliver already-published rows on a second drain call', async () => {
    const repo = makeRepo(3);
    const firstPass: string[] = [];
    const secondPass: string[] = [];

    await repo.drainBatch(10, async (record) => {
      firstPass.push(record.id);
    });

    await repo.drainBatch(10, async (record) => {
      secondPass.push(record.id);
    });

    expect(firstPass).toHaveLength(3);
    expect(secondPass).toHaveLength(0);
  });
});
