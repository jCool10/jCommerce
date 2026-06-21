import { Injectable } from '@nestjs/common';
import type { DirectEventPublisher } from '../../application/ports/direct-event-publisher.port.js';
import { RabbitMqEventPublisher } from './rabbitmq-event-publisher.adapter.js';

/**
 * Synchronous publish adapter for the Stripe webhook handler. Reuses the
 * confirm-channel publisher so publish only resolves after RabbitMQ acks the
 * durable write; the handler awaits it and 500s on failure so Stripe retries.
 *
 * If publish fails after the idempotency row is already inserted the order
 * stays in PAYMENT_PENDING — the reconciler cron is the safety net.
 */
@Injectable()
export class RabbitMqDirectEventPublisher implements DirectEventPublisher {
  constructor(private readonly publisher: RabbitMqEventPublisher) {}

  async publish(routingKey: string, payload: unknown): Promise<void> {
    await this.publisher.publish(routingKey, payload);
  }
}
