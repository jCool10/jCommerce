import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'tracing-bootstrap': 'src/tracing/tracing-bootstrap.ts',
    'sentry-init': 'src/sentry/sentry-init.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  // pino + OTel SDK bring in native + dynamic-require flows that confuse
  // bundlers. Keep them external so the consuming app resolves them.
  external: [
    'pino',
    'pino-http',
    'pino-pretty',
    'prom-client',
    '@opentelemetry/api',
    '@opentelemetry/sdk-node',
    '@opentelemetry/auto-instrumentations-node',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/resources',
    '@opentelemetry/semantic-conventions',
    '@opentelemetry/propagator-b3',
    '@sentry/node',
    '@nestjs/common',
    '@nestjs/core',
    'reflect-metadata',
    'rxjs',
  ],
});
