import { Histogram } from 'prom-client';
import { getRegistry } from './metrics-registry.js';

const buckets = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5];

let _dbDuration: Histogram<string> | null = null;

export function dbQueryDurationSeconds(): Histogram<string> {
  if (_dbDuration) return _dbDuration;
  _dbDuration = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation', 'table'],
    buckets,
    registers: [getRegistry()],
  });
  return _dbDuration;
}

/**
 * Prisma middleware contract — usage in a service:
 *
 *   prisma.$use(createPrismaMetricsMiddleware());
 *
 * Falls back to `unknown` if Prisma changes the param shape so a future
 * version doesn't break boot.
 */
export interface PrismaMiddlewareParams {
  model?: string;
  action: string;
}

export function createPrismaMetricsMiddleware() {
  return async function metricsMiddleware<T>(
    params: PrismaMiddlewareParams,
    next: (params: PrismaMiddlewareParams) => Promise<T>,
  ): Promise<T> {
    const end = dbQueryDurationSeconds().startTimer({
      operation: params.action ?? 'unknown',
      table: params.model ?? 'raw',
    });
    try {
      return await next(params);
    } finally {
      end();
    }
  };
}
