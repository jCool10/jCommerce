import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@jcool/observability';
import { RabbitMqConnection } from './modules/consumer/rabbitmq-connection.service.js';
import { OrderConfirmedConsumer } from './modules/consumer/order-confirmed.consumer.js';
import { DevUserEmailResolver } from './modules/consumer/dev-user-email-resolver.adapter.js';
import { USER_EMAIL_RESOLVER } from './modules/consumer/user-email-resolver.port.js';
import { BullMqEmailQueue } from './modules/queue/bullmq-email-queue.adapter.js';
import { EMAIL_JOB_ENQUEUER } from './modules/queue/email-job-enqueuer.port.js';
import { BullMqEmailWorker } from './modules/worker/bullmq-email-worker.service.js';
import { OrderConfirmationRendererService } from './modules/templates/order-confirmation-renderer.service.js';
import { NodemailerSmtpSender } from './modules/smtp/nodemailer-smtp.sender.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    // email-worker is a standalone application context — no HTTP adapter.
    // Disable interceptor (no req/res cycle) + /metrics controller (we use
    // metrics-server.ts to expose Prometheus on :9100 instead).
    ObservabilityModule.forRoot({
      service: 'email-worker',
      disableCorrelation: true,
      disableMetricsEndpoint: true,
    }),
  ],
  providers: [
    RabbitMqConnection,
    DevUserEmailResolver,
    { provide: USER_EMAIL_RESOLVER, useExisting: DevUserEmailResolver },
    BullMqEmailQueue,
    { provide: EMAIL_JOB_ENQUEUER, useExisting: BullMqEmailQueue },
    OrderConfirmationRendererService,
    NodemailerSmtpSender,
    BullMqEmailWorker,
    OrderConfirmedConsumer,
  ],
})
export class AppModule {}
