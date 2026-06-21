import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { parseRedisUrl } from '../redis/parse-redis-url.js';
import {
  EMAIL_JOB_NAME,
  emailDefaultJobOptions,
} from './email-job-config.js';
import type {
  EmailJobEnqueuer,
  OrderConfirmationJob,
} from './email-job-enqueuer.port.js';

@Injectable()
export class BullMqEmailQueue
  implements EmailJobEnqueuer, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BullMqEmailQueue.name);
  private queue: Queue | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url =
      this.config.get<string>('EMAIL_WORKER_REDIS_URL') ?? 'redis://localhost:6379/3';
    const queueName = this.config.get<string>('EMAIL_QUEUE_NAME') ?? 'email';
    // Pass connection options (not an ioredis instance) so BullMQ owns
    // the client lifecycle and we sidestep the pnpm hoisted-ioredis
    // version mismatch with bullmq.
    this.queue = new Queue(queueName, {
      connection: { ...parseRedisUrl(url), maxRetriesPerRequest: null },
      defaultJobOptions: emailDefaultJobOptions,
    });
    this.logger.log(`bullmq queue ready: ${queueName}`);
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.queue?.close();
    } catch (error) {
      this.logger.error(`error closing queue: ${(error as Error).message}`);
    }
  }

  async enqueueOrderConfirmation(job: OrderConfirmationJob): Promise<void> {
    if (!this.queue) throw new Error('queue not initialised');
    // `jobId = orderId` collapses any RabbitMQ redelivery into a single
    // BullMQ job — second add() with the same jobId is a no-op.
    await this.queue.add(EMAIL_JOB_NAME, job, { jobId: job.orderId });
  }
}
