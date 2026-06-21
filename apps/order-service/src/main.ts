import './instrument.js';
import 'reflect-metadata';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import {
  PINO_LOGGER,
  PinoNestLogger,
  SentryExceptionFilter,
  type PinoLogger,
} from '@jcool/observability';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  // `rawBody: true` captures the original request bytes onto `req.rawBody`
  // for every route (Stripe webhook signature verification needs the
  // unmodified payload). The global JSON parser still populates `req.body`
  // for non-webhook routes, so no other controller is affected.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(new PinoNestLogger(app.get<PinoLogger>(PINO_LOGGER)));
  app.setGlobalPrefix('api', { exclude: ['metrics'] });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  // Sentry error forwarder — must wrap the existing default filter so
  // responses still render. Skipped automatically when no DSN is set.
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionFilter(httpAdapterHost.httpAdapter));
  app.enableShutdownHooks();
  const port = Number(process.env.ORDER_PORT ?? process.env.PORT ?? 3004);
  await app.listen(port);
  Logger.log(`order-service listening on :${port}`, 'Bootstrap');
}

void bootstrap().catch((err) => {
  // Surface boot failures and exit so the orchestrator (Docker/Cloud Run)
  // can restart the container instead of silently leaving it half-started.
  Logger.error((err as Error).stack ?? String(err), 'Bootstrap');
  process.exit(1);
});
