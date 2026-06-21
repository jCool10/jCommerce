import { getCorrelationContext } from '../logger/correlation-context.js';
import { getActiveTraceparent } from './saga-spans.js';

/**
 * Build the set of propagation headers the HTTP/RabbitMQ clients should
 * attach on every outbound call. Lets us pass:
 *   - W3C `traceparent` so receiving services link spans into the same trace
 *   - `x-request-id` so logs across services share a correlation id
 */
export function buildPropagationHeaders(): Record<string, string> {
  const out: Record<string, string> = {};
  const tp = getActiveTraceparent();
  if (tp) out.traceparent = tp;
  const ctx = getCorrelationContext();
  if (ctx?.correlationId) out['x-request-id'] = ctx.correlationId;
  return out;
}
