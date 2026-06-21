/**
 * Sentry error-reporter bootstrap. Load AFTER `startTracing()` in
 * `instrument.ts` so the OTel SDK owns the global tracer provider —
 * Sentry is configured here as an errors-only SDK (`tracesSampleRate: 0`
 * + `skipOpenTelemetrySetup: true`) to avoid fighting the existing
 * OTel bootstrap. Tracing stays on the Tempo path; Sentry only
 * collects unhandled exceptions, captured errors, and 5xx events.
 *
 * No DSN configured → init is a no-op. Lets dev/test environments boot
 * without paying for or pointing at a Sentry project.
 *
 * Usage:
 *   import { startTracing } from '@jcool/observability/dist/tracing-bootstrap.js';
 *   import { initSentry } from '@jcool/observability/dist/sentry-init.js';
 *   startTracing({ service: 'order-service' });
 *   initSentry({ service: 'order-service' });
 */
import * as Sentry from '@sentry/node';

let initialized = false;
let shutdownHandler: (() => void) | null = null;

export interface InitSentryOptions {
  /** Logical service name, stamped as `serverName` + `service` tag. */
  service: string;
  /** Override Sentry DSN. Falls back to `process.env.SENTRY_DSN`. */
  dsn?: string;
  /** `production` / `staging` / `development`. Falls back to NODE_ENV. */
  environment?: string;
  /** Release identifier (matches OTel `service.version`). Defaults to `GIT_SHA`. */
  release?: string;
}

/**
 * Initialize the Sentry Node SDK once. Subsequent calls are no-ops so
 * accidental double-load (CLI entrypoint + HTTP entrypoint in the same
 * process) doesn't double-report.
 */
export function initSentry(opts: string | InitSentryOptions): void {
  if (initialized) return;
  const config: InitSentryOptions =
    typeof opts === 'string' ? { service: opts } : opts;

  const dsn = config.dsn ?? process.env.SENTRY_DSN;
  if (!dsn) {
    // Optional dependency — no DSN means errors stay local. We DO NOT
    // throw here because dev/test envs frequently lack a Sentry project.
    return;
  }

  try {
    Sentry.init({
      dsn,
      serverName: config.service,
      environment:
        config.environment ??
        process.env.SENTRY_ENVIRONMENT ??
        process.env.NODE_ENV ??
        'development',
      release:
        config.release ??
        process.env.SENTRY_RELEASE ??
        process.env.GIT_SHA ??
        undefined,
      // The OTel SDK started by `startTracing()` already owns the global
      // tracer provider. Telling Sentry to skip its own setup prevents a
      // second OTel boot that would race for instrumentation hooks.
      skipOpenTelemetrySetup: true,
      // Performance tracing lives in Tempo. Keeping Sentry off the trace
      // path avoids double-billing spans and keeps Sentry purely about
      // exceptions.
      tracesSampleRate: 0,
      // Stamp every event with the service tag so Sentry's UI can filter
      // across the fleet without relying on serverName parsing.
      initialScope: { tags: { service: config.service } },
    });
    initialized = true;
  } catch (err) {
    // Never fail boot because Sentry can't reach its endpoint — log and
    // continue. The service runs without error reporting; OTel/Prom stay
    // unaffected.
    process.stderr.write(
      `[observability] sentry init failed: ${(err as Error).message}\n`,
    );
    return;
  }

  // Best-effort flush on shutdown so the last batch of errors escapes
  // before the process exits. Stored on a module-scoped ref so test
  // resets can detach the listener (otherwise vitest fires SIGTERM
  // after teardown and the handler races the closed mock).
  shutdownHandler = (): void => {
    void Sentry.close(2000).catch(() => {
      /* swallow — process is exiting */
    });
  };
  process.once('SIGTERM', shutdownHandler);
  process.once('SIGINT', shutdownHandler);
}

/**
 * True when `initSentry` has installed the SDK in this process — useful
 * for skipping `captureException` shortcuts in unit tests.
 */
export function isSentryInitialized(): boolean {
  return initialized;
}

/** Reset state — TEST ONLY. */
export function __resetSentryForTests(): void {
  initialized = false;
  if (shutdownHandler) {
    process.removeListener('SIGTERM', shutdownHandler);
    process.removeListener('SIGINT', shutdownHandler);
    shutdownHandler = null;
  }
}

// Re-export the bits services typically need so they don't add a direct
// `@sentry/node` dep just to capture an error.
export {
  captureException,
  captureMessage,
  setTag,
  setUser,
  withScope,
} from '@sentry/node';
