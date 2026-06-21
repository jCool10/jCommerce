// Logger
export {
  createLogger,
  type LoggerFactoryOptions,
} from './logger/pino-factory.js';
// Re-export the pino Logger type so consumers don't need a direct dep on pino.
export type { Logger as PinoLogger } from 'pino';
export {
  REDACTION_REPLACEMENT,
  SECRET_PATHS,
  EMAIL_PATHS,
  maskEmail,
} from './logger/redaction-config.js';
export {
  type CorrelationContext,
  CORRELATION_HEADER_CANDIDATES,
  CORRELATION_RESPONSE_HEADER,
  getCorrelationContext,
  runWithCorrelation,
  enrichCorrelationContext,
  newCorrelationId,
} from './logger/correlation-context.js';

// NestJS glue
export { CorrelationInterceptor } from './nestjs/correlation-interceptor.js';
export { HttpMetricsInterceptor } from './nestjs/http-metrics-interceptor.js';
export { MetricsController } from './nestjs/metrics-controller.js';
export { PinoNestLogger } from './nestjs/pino-nest-logger.js';
export { SentryExceptionFilter } from './nestjs/sentry-exception-filter.js';
export {
  ObservabilityModule,
  PINO_LOGGER,
  OBSERVABILITY_SERVICE_NAME,
  type ObservabilityModuleOptions,
} from './nestjs/observability-module.js';

// Sentry (errors-only — tracing handled by OTel)
export {
  captureException,
  captureMessage,
  setTag,
  setUser,
  withScope,
  isSentryInitialized,
} from './sentry/sentry-init.js';
// NOTE: `initSentry` is intentionally NOT re-exported here — load it from
// `@jcool/observability/sentry-init` (or deep `dist/sentry-init.js`) in
// each service's `instrument.ts` so it runs alongside `startTracing`
// before NestJS boots.

// Metrics
export {
  initMetrics,
  getRegistry,
  __resetRegistryForTests,
} from './metrics/metrics-registry.js';
export {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  recordHttpRequest,
  type HttpMetricLabels,
} from './metrics/http-metrics.js';
export {
  dbQueryDurationSeconds,
  createPrismaMetricsMiddleware,
  type PrismaMiddlewareParams,
} from './metrics/database-metrics.js';
export {
  rabbitmqMessagesPublishedTotal,
  rabbitmqMessagesConsumedTotal,
  rabbitmqConsumerLag,
  recordPublished,
  recordConsumed,
  setQueueDepth,
  type ConsumeStatus,
} from './metrics/rabbitmq-metrics.js';
export {
  bullmqJobDurationSeconds,
  bullmqJobFailedTotal,
  bullmqQueueDepth,
  attachBullmqEvents,
  setBullmqDepth,
  type BullmqEventsLike,
  type BullmqJobMetadata,
} from './metrics/queue-metrics.js';
export {
  ordersCreatedTotal,
  revenueSubunitTotal,
  sagaCompensationsTotal,
  inventoryReservedTotal,
  outboxEventsPending,
  recordOrderCreated,
  recordRevenue,
  recordSagaCompensation,
  recordInventoryReservation,
  setOutboxPending,
} from './metrics/business-metrics.js';

// DLQ depth collector (opt-in — host service calls start()/stop())
export {
  createDLQDepthCollector,
  type DLQDepthCollectorOptions,
  type DLQDepthCollector,
} from './prometheus/dlq-depth-collector.js';

// Tracing
export {
  withSpan,
  getActiveTraceparent,
  startConsumerSpan,
  type SpanAttributes,
} from './tracing/saga-spans.js';
export { buildPropagationHeaders } from './tracing/trace-headers.js';
// NOTE: `startTracing` is NOT re-exported here. Import from
// `@jcool/observability/tracing-bootstrap` so it stays load-ordered FIRST
// in main.ts (before NestJS) — accidentally pulling it through this barrel
// would defeat auto-instrumentation.
