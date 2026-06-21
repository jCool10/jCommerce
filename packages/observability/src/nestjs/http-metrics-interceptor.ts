import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { recordHttpRequest } from '../metrics/http-metrics.js';

interface ReqLike {
  method?: string;
  route?: { path?: string };
  baseUrl?: string;
  originalUrl?: string;
  url?: string;
}

interface ResLike {
  statusCode?: number;
}

/**
 * Records `http_requests_total` + `http_request_duration_seconds` per
 * request. Uses Express's resolved route template (`/api/v1/users/:id`)
 * when present to keep label cardinality bounded; falls back to method
 * + status only for unmatched routes.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const start = process.hrtime.bigint();
    const http = context.switchToHttp();
    const req = http.getRequest<ReqLike>();
    const res = http.getResponse<ResLike>();
    const method = (req?.method ?? 'UNKNOWN').toUpperCase();

    const finalize = (statusOverride?: number) => {
      const durNs = Number(process.hrtime.bigint() - start);
      const durSec = durNs / 1e9;
      const status = String(statusOverride ?? res?.statusCode ?? 0);
      const route = resolveRoute(req);
      // Skip the scrape endpoint itself so we don't pollute the histogram.
      if (route === '/metrics' || route.endsWith('/metrics')) return;
      recordHttpRequest({ method, route, status }, durSec);
    };

    return next.handle().pipe(
      tap({
        next: () => finalize(),
        error: (err: unknown) => {
          const statusFromErr =
            typeof err === 'object' && err !== null && 'status' in err
              ? Number((err as { status: number }).status)
              : 500;
          finalize(Number.isFinite(statusFromErr) ? statusFromErr : 500);
        },
      }),
    );
  }
}

function resolveRoute(req: ReqLike | undefined): string {
  if (!req) return 'unknown';
  const tpl = req.route?.path;
  if (tpl) return `${req.baseUrl ?? ''}${tpl}` || tpl;
  // No Express route template means: 404, proxy passthrough, or middleware
  // -only path. Returning the raw URL here would explode label cardinality
  // (every product id becomes a new series). Use a single sentinel instead.
  return '<unmatched>';
}
