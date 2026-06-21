import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createDLQDepthCollector,
  type DLQDepthCollector,
} from '@jcool/observability';

/**
 * Registers and drives the RabbitMQ DLQ depth collector.
 * Polls the management API every 30 s so Prometheus can scrape current depth.
 * Any depth > 0 means nacked events are accumulating — the alert rule fires
 * after 5 minutes to surface potential silent data loss.
 */
@Injectable()
export class DLQDepthPollerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(DLQDepthPollerService.name);
  private collector: DLQDepthCollector | null = null;

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap(): void {
    const managementUrl = this.config.get<string>('RABBITMQ_MGMT_URL');
    const username = this.config.get<string>('RABBITMQ_MGMT_USER');
    const password = this.config.get<string>('RABBITMQ_MGMT_PASS');

    if (!managementUrl || !username || !password) {
      this.logger.warn(
        'RABBITMQ_MGMT_URL / RABBITMQ_MGMT_USER / RABBITMQ_MGMT_PASS not set — ' +
          'DLQ depth metric will not be collected',
      );
      return;
    }

    this.collector = createDLQDepthCollector({
      managementUrl,
      username,
      password,
      intervalMs: 30_000,
    });

    this.collector.start();
    this.logger.log('DLQ depth collector started (30 s interval)');
  }

  onApplicationShutdown(): void {
    this.collector?.stop();
  }
}
