import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/**
 * Per-request context propagated through the call stack via AsyncLocalStorage.
 * Captures the values that every log line should inherit without explicit
 * passing: correlationId (a.k.a. requestId), the optional traceId stamped by
 * OpenTelemetry, and the authenticated user/order if known.
 */
export interface CorrelationContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  orderId?: string;
  /** Override service name when crossing module boundaries (rare). */
  service?: string;
}

const storage = new AsyncLocalStorage<CorrelationContext>();

/** Return the current context if a request scope is active. */
export function getCorrelationContext(): CorrelationContext | undefined {
  return storage.getStore();
}

/** Run `fn` inside a fresh correlation scope. */
export function runWithCorrelation<T>(
  ctx: CorrelationContext,
  fn: () => T,
): T {
  return storage.run(ctx, fn);
}

/**
 * Merge new fields into the current scope (e.g. `userId` after auth resolves).
 * Mutates the stored object since ALS shares the reference across awaits.
 */
export function enrichCorrelationContext(patch: Partial<CorrelationContext>): void {
  const current = storage.getStore();
  if (!current) return;
  const bag = current as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) bag[key] = value;
  }
}

/** Generate a fresh correlation id (used when no `x-request-id` header). */
export function newCorrelationId(): string {
  return randomUUID();
}

/** Header names the gateway / clients may use to pass an incoming id. */
export const CORRELATION_HEADER_CANDIDATES = [
  'x-request-id',
  'x-correlation-id',
  'request-id',
] as const;

export const CORRELATION_RESPONSE_HEADER = 'x-request-id';
