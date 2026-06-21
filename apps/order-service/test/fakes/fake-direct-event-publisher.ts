import type { DirectEventPublisher } from '../../src/application/ports/direct-event-publisher.port.js';

export class FakeDirectEventPublisher implements DirectEventPublisher {
  readonly published: Array<{ routingKey: string; payload: unknown }> = [];
  private failNext = false;

  async publish(routingKey: string, payload: unknown): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('publish-fail');
    }
    this.published.push({ routingKey, payload });
  }

  failOnce(): void {
    this.failNext = true;
  }
}
