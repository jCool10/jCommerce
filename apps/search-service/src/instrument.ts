// MUST be the very first import in main.ts. OpenTelemetry auto-instrumentation
// patches modules at load time — pulling this after `@nestjs/core` would miss
// the http/pg/ioredis/amqplib hooks and traces would go dark. Sentry follows
// OTel so the OTel SDK keeps ownership of the global tracer provider
// (Sentry is configured errors-only via `skipOpenTelemetrySetup`).
import { startTracing } from '@jcool/observability/dist/tracing-bootstrap.js';
import { initSentry } from '@jcool/observability/dist/sentry-init.js';

startTracing({ service: 'search-service' });
initSentry({ service: 'search-service' });
