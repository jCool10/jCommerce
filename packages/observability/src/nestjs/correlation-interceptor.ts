import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  CORRELATION_HEADER_CANDIDATES,
  CORRELATION_RESPONSE_HEADER,
  newCorrelationId,
  runWithCorrelation,
} from '../logger/correlation-context.js';

interface MinimalHttpReq {
  headers?: Record<string, string | string[] | undefined>;
}

interface MinimalHttpRes {
  setHeader?: (name: string, value: string) => void;
}

/**
 * Reads (or mints) a request id from incoming HTTP headers, stamps the
 * response with the same id, and runs the downstream handler inside an
 * AsyncLocalStorage scope so every log line, span tag, and queued job
 * inherits it. Must be registered globally before route handlers run.
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const correlationId = resolveCorrelationId(context);
    setResponseHeader(context, correlationId);
    return new Observable((subscriber) => {
      runWithCorrelation({ correlationId }, () => {
        const stream$ = next.handle();
        const subscription = stream$.subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
        return () => subscription.unsubscribe();
      });
    });
  }
}

function resolveCorrelationId(context: ExecutionContext): string {
  if (context.getType() !== 'http') return newCorrelationId();
  const req = context.switchToHttp().getRequest<MinimalHttpReq>();
  const headers = req?.headers ?? {};
  for (const candidate of CORRELATION_HEADER_CANDIDATES) {
    const raw = headers[candidate];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string' && value.length > 0 && value.length <= 200) {
      return value;
    }
  }
  return newCorrelationId();
}

function setResponseHeader(context: ExecutionContext, id: string): void {
  if (context.getType() !== 'http') return;
  const res = context.switchToHttp().getResponse<MinimalHttpRes>();
  res?.setHeader?.(CORRELATION_RESPONSE_HEADER, id);
}
