import './instrument.js';
import 'reflect-metadata';
import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import {
  PINO_LOGGER,
  PinoNestLogger,
  SentryExceptionFilter,
  type PinoLogger,
} from '@jcool/observability';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  // bodyParser:false is REQUIRED. Without it Express drains POST/PUT/PATCH
  // bodies into req.body before the proxy can stream them downstream → every
  // checkout/login/cart-update arrives at the backend with an empty payload.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  app.useLogger(new PinoNestLogger(app.get<PinoLogger>(PINO_LOGGER)));

  // Trust the first upstream hop (Cloud Run / Nginx) so req.ip resolves to the
  // real client IP rather than the load-balancer address; without this every
  // request shares the same IP and the Redis rate-limiter throttle is useless.
  const trustProxy = process.env.TRUST_PROXY ?? '1';
  const trustProxyValue: string | number | boolean =
    trustProxy === 'true' ? true : trustProxy === 'false' ? false : (Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy));
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxyValue);

  app.setGlobalPrefix('api', { exclude: ['health', 'metrics'] });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  // CORS — never combine reflective `origin: true` with `credentials: true`
  // (browser will echo any Origin header → CSRF surface). In production we
  // refuse to boot without an explicit allowlist; in dev we fall back to the
  // known storefront+admin localhost origins so the typical workflow still
  // works without a manual env override.
  const origins = parseOrigins(process.env.CORS_ORIGINS);
  const isProd = process.env.NODE_ENV === 'production';
  let allowedOrigins: string[];
  if (origins.length > 0) {
    allowedOrigins = origins;
  } else if (isProd) {
    throw new Error(
      'CORS_ORIGINS is required in production (refusing to boot with permissive CORS + credentials)',
    );
  } else {
    allowedOrigins = ['http://localhost:3100', 'http://localhost:3101'];
    Logger.warn(
      `CORS_ORIGINS unset — falling back to dev allowlist ${allowedOrigins.join(', ')}`,
      'Bootstrap',
    );
  }
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ['authorization', 'content-type', 'x-request-id', 'x-guest-session', 'traceparent'],
    exposedHeaders: ['x-request-id'],
  });

  // Sentry error forwarder — wraps Nest's default filter so responses
  // still render. No-op when SENTRY_DSN is unset.
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionFilter(httpAdapterHost.httpAdapter));

  const port = Number(process.env.GATEWAY_PORT ?? process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`api-gateway listening on :${port}`, 'Bootstrap');
}

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error), 'Bootstrap');
  process.exit(1);
});
