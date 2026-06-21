import pino, { type Logger, type LoggerOptions } from 'pino';
import {
  EMAIL_PATHS,
  REDACTION_REPLACEMENT,
  SECRET_PATHS,
  maskEmail,
} from './redaction-config.js';
import { getCorrelationContext } from './correlation-context.js';

export interface LoggerFactoryOptions {
  /** Logical service name stamped on every log entry. */
  service: string;
  /** Override level; defaults to env LOG_LEVEL or 'info'. */
  level?: string;
  /** Pretty-print in dev (NODE_ENV !== 'production'). */
  pretty?: boolean;
  /** Sampling ratio for info logs in prod (0..1). 1 = no sampling. */
  infoSampleRate?: number;
}

/**
 * Build a singleton Pino logger configured with PII redaction, correlation
 * context, and conditional pretty transport for dev. Errors are never
 * sampled — the sampling hook only filters `info` in prod.
 */
export function createLogger(opts: LoggerFactoryOptions): Logger {
  const isProd = process.env.NODE_ENV === 'production';
  const usePretty = opts.pretty ?? !isProd;
  const level = opts.level ?? process.env.LOG_LEVEL ?? 'info';
  const sampleRate = clampRate(opts.infoSampleRate ?? Number(process.env.LOG_INFO_SAMPLE_RATE) ?? 1);

  const base: LoggerOptions = {
    level,
    base: { service: opts.service, pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [...SECRET_PATHS, ...EMAIL_PATHS],
      censor: (value, path) => {
        if (isEmailPath(path)) return maskEmail(value);
        return REDACTION_REPLACEMENT;
      },
    },
    mixin() {
      const ctx = getCorrelationContext();
      if (!ctx) return {};
      // Spread known fields; skip undefined so they don't pollute output.
      const { correlationId, traceId, spanId, userId, orderId } = ctx;
      const out: Record<string, unknown> = { correlationId };
      if (traceId) out.traceId = traceId;
      if (spanId) out.spanId = spanId;
      if (userId) out.userId = userId;
      if (orderId) out.orderId = orderId;
      return out;
    },
  };

  if (isProd && sampleRate < 1) {
    base.hooks = {
      logMethod(args, method, levelNum) {
        // Pino sets numeric levels: 30 = info. Only sample info; warn/error/fatal pass.
        if (levelNum === 30 && Math.random() > sampleRate) return;
        return method.apply(this, args);
      },
    };
  }

  if (usePretty) {
    return pino({
      ...base,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname,service',
          messageFormat: '[{service}] {msg}',
        },
      },
    });
  }

  return pino(base);
}

function clampRate(n: number): number {
  if (!Number.isFinite(n)) return 1;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function isEmailPath(path: ReadonlyArray<string>): boolean {
  return path.some((segment) => segment === 'email');
}
