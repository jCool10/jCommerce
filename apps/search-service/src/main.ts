import './instrument.js';
import 'reflect-metadata';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';
import {
  PINO_LOGGER,
  PinoNestLogger,
  SentryExceptionFilter,
  type PinoLogger,
} from '@jcool/observability';
import { AppModule } from './app.module.js';

const args = process.argv.slice(2);
const KNOWN_COMMANDS = new Set(['reindex']);

async function bootstrapHttp(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(new PinoNestLogger(app.get<PinoLogger>(PINO_LOGGER)));
  app.setGlobalPrefix('api', { exclude: ['metrics'] });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  // Sentry error forwarder — wraps Nest's default filter so responses
  // still render. No-op when SENTRY_DSN is unset.
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionFilter(httpAdapterHost.httpAdapter));
  const port = Number(process.env.PORT ?? 3003);
  await app.listen(port);
  Logger.log(`search-service listening on :${port}`, 'Bootstrap');
}

async function runCli(): Promise<void> {
  await CommandFactory.run(AppModule, { logger: ['log', 'warn', 'error'] });
}

const runner =
  args.length > 0 && KNOWN_COMMANDS.has(args[0] as string) ? runCli : bootstrapHttp;
runner().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.stack ?? error.message : String(error), 'Bootstrap');
  process.exit(1);
});
