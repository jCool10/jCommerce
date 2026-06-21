import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { setOutboxPending } from '@jcool/observability';
import {
  OUTBOX_REPOSITORY,
  type OutboxRepository,
} from '../../domain/ports/outbox.repository.js';
import { RabbitMqEventPublisher } from './rabbitmq-event-publisher.adapter.js';

/**
 * Transactional outbox poller.
 *   - Every second: drain up to BATCH_SIZE unpublished events
 *   - Uses FOR UPDATE SKIP LOCKED inside a single DB transaction, making this
 *     safe to run on multiple replicas — each replica claims a disjoint row set
 *   - On RabbitMQ failure the row stays unpublished; next tick retries
 *   - On transaction failure all locks are released; next tick retries
 */
@Injectable()
export class OutboxPollerCron {
  private readonly logger = new Logger(OutboxPollerCron.name);
  private readonly batchSize: number;
  private busy = false;

  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly outbox: OutboxRepository,
    private readonly publisher: RabbitMqEventPublisher,
    config: ConfigService,
  ) {
    this.batchSize = Number(config.get('ORDER_OUTBOX_BATCH_SIZE') ?? 100);
  }

  @Cron(CronExpression.EVERY_SECOND)
  async drain(): Promise<void> {
    if (this.busy) return; // skip overlapping ticks within the same process
    this.busy = true;
    try {
      const { total, published } = await this.outbox.drainBatch(
        this.batchSize,
        (record) => this.publisher.publish(record.routingKey, record.payload),
      );

      setOutboxPending('order', Math.max(0, total - published));

      if (total > 0 && published < total) {
        this.logger.warn(
          `order outbox: ${published}/${total} published; ${total - published} will retry`,
        );
      }
    } catch (error) {
      this.logger.error(
        `order outbox drain failed: ${(error as Error).message}`,
      );
    } finally {
      this.busy = false;
    }
  }
}
