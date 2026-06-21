// MUST be the very first import in main.ts. OpenTelemetry auto-instrumentation
// patches modules at load time — pulling this after `@nestjs/core` would miss
// the http/pg/ioredis/amqplib hooks and traces would go dark.
// Deep import bypasses package.json `exports` subpath (NestJS apps use
// moduleResolution: Node which doesn't support exports). Functionally
// identical to importing from the subpath under NodeNext resolution.
// Sentry follows OTel so the OTel SDK keeps ownership of the global tracer
// provider — Sentry is errors-only here (skipOpenTelemetrySetup + 0 trace rate).
import { startTracing } from '@jcool/observability/dist/tracing-bootstrap.js';
import { initSentry } from '@jcool/observability/dist/sentry-init.js';

startTracing({ service: 'auth-service' });
initSentry({ service: 'auth-service' });
