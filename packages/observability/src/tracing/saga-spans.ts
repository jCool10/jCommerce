import { trace, SpanStatusCode, type Span } from '@opentelemetry/api';
import { enrichCorrelationContext } from '../logger/correlation-context.js';

const TRACER_NAME = 'jcool.saga';

export type SpanAttributes = Record<string, string | number | boolean>;

/**
 * Run `fn` inside a named span and attach attributes. Records exceptions and
 * sets ERROR status on throw so saga compensations are visible in Tempo.
 *
 * Also stamps the active trace id into the AsyncLocalStorage correlation
 * context so subsequent log lines emitted inside `fn` carry `traceId`.
 */
export async function withSpan<T>(
  name: string,
  attrs: SpanAttributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer(TRACER_NAME);
  return tracer.startActiveSpan(name, { attributes: attrs }, async (span) => {
    try {
      const spanCtx = span.spanContext();
      enrichCorrelationContext({ traceId: spanCtx.traceId, spanId: spanCtx.spanId });
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Return the current trace + span id pair if any. Used by the RabbitMQ
 * publisher to attach `traceparent` headers (W3C trace context).
 */
export function getActiveTraceparent(): string | undefined {
  const active = trace.getActiveSpan();
  if (!active) return undefined;
  const ctx = active.spanContext();
  if (!ctx.traceId || ctx.traceId === '00000000000000000000000000000000') return undefined;
  // W3C traceparent: version-traceId-spanId-flags
  const flags = ctx.traceFlags.toString(16).padStart(2, '0');
  return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
}

/**
 * Continue an upstream trace given a `traceparent` header. Returns the span
 * so the caller can end it after the consumer finishes work.
 */
export function startConsumerSpan(name: string, traceparent: string | undefined, attrs: SpanAttributes): Span {
  const tracer = trace.getTracer(TRACER_NAME);
  // We rely on auto-instrumentation/W3C propagator already configured by the
  // SDK — but RabbitMQ doesn't have HTTP context to pick traceparent from.
  // The producer copies it into message headers; here we set it on attrs so
  // it shows up linked even if the global propagator can't reconstruct.
  const span = tracer.startSpan(name, { attributes: { ...attrs, 'messaging.traceparent': traceparent ?? '' } });
  if (traceparent) {
    const parts = traceparent.split('-');
    if (parts.length === 4 && parts[1]) {
      enrichCorrelationContext({ traceId: parts[1], spanId: span.spanContext().spanId });
    }
  } else {
    enrichCorrelationContext({
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
    });
  }
  return span;
}
