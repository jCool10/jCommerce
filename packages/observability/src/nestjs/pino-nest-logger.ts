import { type LoggerService } from '@nestjs/common';
import type { Logger as PinoLogger } from 'pino';

/**
 * Adapter that lets NestJS internals (and user code calling `Logger.log`)
 * funnel through the shared Pino instance, so all messages get correlation
 * context, redaction, and structured fields automatically.
 */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly pino: PinoLogger) {}

  log(message: unknown, context?: string): void {
    this.pino.info({ context }, stringify(message));
  }

  error(message: unknown, stackOrContext?: string, context?: string): void {
    // NestJS calls `error(msg, stack, context)` for thrown errors and
    // `error(msg, context)` for plain warnings. Distinguish by arg count.
    if (context === undefined) {
      this.pino.error({ context: stackOrContext }, stringify(message));
      return;
    }
    this.pino.error({ context, err: { stack: stackOrContext } }, stringify(message));
  }

  warn(message: unknown, context?: string): void {
    this.pino.warn({ context }, stringify(message));
  }

  debug(message: unknown, context?: string): void {
    this.pino.debug({ context }, stringify(message));
  }

  verbose(message: unknown, context?: string): void {
    this.pino.trace({ context }, stringify(message));
  }

  fatal(message: unknown, context?: string): void {
    this.pino.fatal({ context }, stringify(message));
  }
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
