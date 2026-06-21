import type { EventPublisher } from '../../src/application/ports/event-publisher.port.js';

export class FakeEventPublisher implements EventPublisher {
  readonly published: Array<{ routingKey: string; payload: unknown }> = [];

  async publish(routingKey: string, payload: unknown): Promise<void> {
    this.published.push({ routingKey, payload });
  }
}
