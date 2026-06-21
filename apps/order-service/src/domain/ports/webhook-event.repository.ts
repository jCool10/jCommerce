/**
 * Webhook idempotency port. Backed by a Postgres UNIQUE constraint on
 * `stripe_event_id`, which is the single source of dedup truth.
 *
 * `recordIfNew` is the only operation: try-insert with conflict detection.
 *   - returns true  → first time seeing this event id (caller MUST process)
 *   - returns false → duplicate (caller MUST treat as no-op)
 *
 * Race-free: two concurrent callers with the same stripeEventId can BOTH
 * call recordIfNew; exactly one gets true. Postgres UNIQUE enforces this.
 */
export interface WebhookEventRecord {
  stripeEventId: string;
  type: string;
  payload: unknown;
}

export interface WebhookEventRepository {
  recordIfNew(record: WebhookEventRecord): Promise<boolean>;
}

export const WEBHOOK_EVENT_REPOSITORY = Symbol('WEBHOOK_EVENT_REPOSITORY');
