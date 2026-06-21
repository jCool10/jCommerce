import { Injectable, Logger } from '@nestjs/common';
import type { EventPublisher } from '../../application/ports/event-publisher.port.js';

/**
 * Placeholder publisher that just logs events. The real RabbitMQ publisher
 * lives in @jcool/messaging; swapping it in is only a DI binding change.
 */
@Injectable()
export class NoopEventPublisher implements EventPublisher {
  private readonly logger = new Logger(NoopEventPublisher.name);

  async publish(routingKey: string, payload: unknown): Promise<void> {
    this.logger.log(`event ${routingKey}: ${JSON.stringify(payload)}`);
  }
}
