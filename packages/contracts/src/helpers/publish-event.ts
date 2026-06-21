import type { z } from 'zod';
import { EVENTS_EXCHANGE, type RoutingKey } from '../events/routing-keys.js';

// Runtime-agnostic publisher port. Services wire their amqplib (or other) client
// to this interface — the contracts package stays free of Node-only types.
export interface EventPublisher {
  publish(exchange: string, routingKey: string, body: string): Promise<void> | void;
}

// Validates payload against schema before publishing.
// Throws if payload fails schema — prevents producers from emitting malformed events.
export async function publishEvent<T extends z.ZodTypeAny>(
  publisher: EventPublisher,
  routingKey: RoutingKey,
  schema: T,
  payload: z.infer<T>,
): Promise<void> {
  const validated = schema.parse(payload);
  await publisher.publish(EVENTS_EXCHANGE, routingKey, JSON.stringify(validated));
}
