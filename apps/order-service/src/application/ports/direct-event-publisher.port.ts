/**
 * Synchronous publish port used by the Stripe webhook handler. Unlike the
 * outbox (which gives at-least-once delivery for state-change emissions
 * from saga writes), the webhook handler treats RabbitMQ publish + the
 * idempotency row as the atomic external boundary: the webhook_events
 * UNIQUE constraint is the single source of dedup truth.
 *
 * Adapter = thin facade over `RabbitMqEventPublisher` to keep the use case
 * free of infra imports.
 */
export interface DirectEventPublisher {
  publish(routingKey: string, payload: unknown): Promise<void>;
}

export const DIRECT_EVENT_PUBLISHER = Symbol('DIRECT_EVENT_PUBLISHER');
