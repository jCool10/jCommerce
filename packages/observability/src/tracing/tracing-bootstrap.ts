/**
 * MUST be imported as the FIRST thing in every service `main.ts` —
 * BEFORE NestFactory / AppModule. Auto-instrumentation patches happen
 * at module-load time; loading this after NestJS misses the http,
 * pg, ioredis, amqplib hooks and trace data goes dark.
 *
 * Usage:
 *   import { startTracing } from '@jcool/observability/tracing-bootstrap';
 *   startTracing('auth-service');
 *   // ... then import AppModule, etc.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

const ATTR_DEPLOYMENT_ENVIRONMENT = 'deployment.environment';

let started = false;
let sdkRef: NodeSDK | null = null;

export interface StartTracingOptions {
  /** Logical service name — must match Prometheus `service` label. */
  service: string;
  /** Defaults to `process.env.OTEL_EXPORTER_OTLP_ENDPOINT` or http://localhost:4318. */
  endpoint?: string;
  /** Build/release SHA stamped on every span. */
  version?: string;
  /** Set to `true` to dump OTel internals to stderr (debugging only). */
  debug?: boolean;
}

export function startTracing(serviceOrOpts: string | StartTracingOptions): void {
  if (started) return;
  const opts: StartTracingOptions =
    typeof serviceOrOpts === 'string' ? { service: serviceOrOpts } : serviceOrOpts;

  // Allow opt-out via env so unit tests / CLI seeds can skip trace setup.
  if (process.env.OTEL_SDK_DISABLED === '1' || process.env.OTEL_SDK_DISABLED === 'true') {
    return;
  }

  if (opts.debug) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const endpoint =
    opts.endpoint ??
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    'http://localhost:4318';

  const tracesEndpoint = endpoint.endsWith('/v1/traces')
    ? endpoint
    : `${endpoint.replace(/\/$/, '')}/v1/traces`;

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: opts.service,
      [ATTR_SERVICE_VERSION]: opts.version ?? process.env.GIT_SHA ?? 'dev',
      [ATTR_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({ url: tracesEndpoint }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs is far too chatty in dev — disable.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // dns spans drown out HTTP context.
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  try {
    sdk.start();
    sdkRef = sdk;
    started = true;
  } catch (err) {
    // Don't fail boot if the SDK can't start (bad endpoint, missing native
    // module, etc.). Log to stderr and continue; the app will run without
    // traces. Errors / metrics paths are unaffected.
    process.stderr.write(
      `[observability] tracing init failed: ${(err as Error).message}\n`,
    );
    return;
  }

  // Best-effort flush on SIGTERM so the last spans escape to Tempo.
  const shutdown = () => {
    if (!sdkRef) return;
    sdkRef
      .shutdown()
      .catch(() => {
        /* swallow — process is exiting */
      })
      .finally(() => {
        sdkRef = null;
      });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
