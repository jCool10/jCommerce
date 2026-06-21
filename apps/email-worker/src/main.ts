import './instrument.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { PINO_LOGGER, PinoNestLogger, type PinoLogger } from '@jcool/observability';
import { AppModule } from './app.module.js';

/**
 * Standalone NestJS app — no HTTP server. The lifecycle is driven by:
 *   - RabbitMQ consumer (order-confirmed) → enqueue BullMQ job
 *   - BullMQ worker → render + SMTP send
 * `enableShutdownHooks()` ensures consumers/workers/connections drain on SIGTERM.
 *
 * Metrics for this worker are exposed via a tiny standalone HTTP listener
 * (see metrics-server.ts) since the app context has no HTTP adapter.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(new PinoNestLogger(app.get<PinoLogger>(PINO_LOGGER)));
  app.enableShutdownHooks();
  const { startMetricsServer } = await import('./metrics-server.js');
  startMetricsServer();
  Logger.log('email-worker running (consumer + bullmq worker)', 'Bootstrap');
}

void bootstrap().catch((err) => {
  Logger.error((err as Error).stack ?? String(err), 'Bootstrap');
  process.exit(1);
});
