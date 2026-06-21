import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import {
  bullmqJobDurationSeconds,
  bullmqJobFailedTotal,
} from '@jcool/observability';
import {
  processOrderConfirmationJob,
} from './email-worker.processor.js';
import { OrderConfirmationRendererService } from '../templates/order-confirmation-renderer.service.js';
import { NodemailerSmtpSender } from '../smtp/nodemailer-smtp.sender.js';
import { parseRedisUrl } from '../redis/parse-redis-url.js';
import type { OrderConfirmationJob } from '../queue/email-job-enqueuer.port.js';

@Injectable()
export class BullMqEmailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullMqEmailWorker.name);
  private worker: Worker<OrderConfirmationJob> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly renderer: OrderConfirmationRendererService,
    private readonly smtp: NodemailerSmtpSender,
  ) {}

  onModuleInit(): void {
    if (process.env.EMAIL_DISABLE_WORKER === '1') {
      this.logger.warn('EMAIL_DISABLE_WORKER=1 → worker not started');
      return;
    }
    const url =
      this.config.get<string>('EMAIL_WORKER_REDIS_URL') ?? 'redis://localhost:6379/3';
    const queueName = this.config.get<string>('EMAIL_QUEUE_NAME') ?? 'email';
    const concurrency = Number(this.config.get<string>('EMAIL_QUEUE_CONCURRENCY') ?? '4');
    this.worker = new Worker<OrderConfirmationJob>(
      queueName,
      async (bullJob) => {
        await processOrderConfirmationJob(bullJob.data, {
          renderer: this.renderer,
          smtp: this.smtp,
        });
      },
      {
        connection: { ...parseRedisUrl(url), maxRetriesPerRequest: null },
        concurrency,
      },
    );
    this.worker.on('failed', (bullJob, err) => {
      this.logger.warn(
        `job failed id=${bullJob?.id} attempts=${bullJob?.attemptsMade}/${bullJob?.opts.attempts}: ${err.message}`,
      );
      bullmqJobFailedTotal()
        .labels({ queue: queueName, name: bullJob?.name ?? 'unknown' })
        .inc();
      const duration = jobDurationSeconds(bullJob);
      if (duration !== null && bullJob) {
        bullmqJobDurationSeconds()
          .labels({ queue: queueName, name: bullJob.name })
          .observe(duration);
      }
      if (bullJob && bullJob.attemptsMade >= (bullJob.opts.attempts ?? 1)) {
        // Final failure — BullMQ moves to failed set (acts as DLQ).
        this.logger.error(
          `job exhausted retries id=${bullJob.id} order=${bullJob.data.orderId}; in failed set`,
        );
      }
    });
    this.worker.on('completed', (bullJob) => {
      this.logger.log(`job completed id=${bullJob.id} order=${bullJob.data.orderId}`);
      const duration = jobDurationSeconds(bullJob);
      if (duration !== null) {
        bullmqJobDurationSeconds()
          .labels({ queue: queueName, name: bullJob.name })
          .observe(duration);
      }
    });
    this.logger.log(`bullmq worker ready: ${queueName} (concurrency=${concurrency})`);
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.worker?.close();
    } catch (error) {
      this.logger.error(`error closing worker: ${(error as Error).message}`);
    }
  }
}

/** BullMQ stamps `processedOn` after the handler resolves. Returns seconds. */
function jobDurationSeconds(job: Job | undefined | null): number | null {
  if (!job?.processedOn || !job.timestamp) return null;
  return Math.max(0, (job.processedOn - job.timestamp) / 1000);
}
