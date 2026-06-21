import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';
import {
  EMAIL_PATHS,
  REDACTION_REPLACEMENT,
  SECRET_PATHS,
  maskEmail,
} from '../src/logger/redaction-config.js';

interface Captured {
  lines: unknown[];
}

function captureLogger() {
  const captured: Captured = { lines: [] };
  const sink = new Writable({
    write(chunk, _enc, cb) {
      try {
        captured.lines.push(JSON.parse(chunk.toString()));
      } catch {
        captured.lines.push(chunk.toString());
      }
      cb();
    },
  });
  const logger = pino(
    {
      level: 'info',
      redact: {
        paths: [...SECRET_PATHS, ...EMAIL_PATHS],
        censor: (value, path) => {
          if (path.some((s) => s === 'email')) return maskEmail(value);
          return REDACTION_REPLACEMENT;
        },
      },
    },
    sink,
  );
  return { logger, captured };
}

describe('logger redaction', () => {
  it('replaces password in request body with [Redacted]', () => {
    const { logger, captured } = captureLogger();
    logger.info({ req: { body: { password: 'secret123', username: 'alice' } } }, 'login attempt');
    const entry = captured.lines.at(-1) as { req: { body: { password: string; username: string } } };
    expect(entry.req.body.password).toBe('[Redacted]');
    expect(entry.req.body.username).toBe('alice');
  });

  it('redacts Authorization header', () => {
    const { logger, captured } = captureLogger();
    logger.info({ req: { headers: { authorization: 'Bearer abc.def.ghi' } } }, 'request');
    const entry = captured.lines.at(-1) as { req: { headers: { authorization: string } } };
    expect(entry.req.headers.authorization).toBe('[Redacted]');
  });

  it('redacts credit card and cvv anywhere via wildcard', () => {
    const { logger, captured } = captureLogger();
    logger.info({ payment: { creditCard: '4242424242424242', cvv: '123' } }, 'pay');
    const entry = captured.lines.at(-1) as { payment: { creditCard: string; cvv: string } };
    expect(entry.payment.creditCard).toBe('[Redacted]');
    expect(entry.payment.cvv).toBe('[Redacted]');
  });

  it('partially masks email keeping first character and domain', () => {
    expect(maskEmail('alice@example.com')).toBe('a***@example.com');
    expect(maskEmail('j@x.io')).toBe('j***@x.io');
    expect(maskEmail('not-an-email')).toBe('[Redacted]');
    expect(maskEmail(123)).toBe(123);
  });

  it('masks user.email field in logged objects', () => {
    const { logger, captured } = captureLogger();
    logger.info({ user: { id: 'u1', email: 'bob@acme.org' } }, 'user lookup');
    const entry = captured.lines.at(-1) as { user: { email: string } };
    expect(entry.user.email).toBe('b***@acme.org');
  });

  it('does NOT touch non-secret fields', () => {
    const { logger, captured } = captureLogger();
    logger.info({ req: { body: { quantity: 5, sku: 'ABC' } } }, 'cart add');
    const entry = captured.lines.at(-1) as { req: { body: { quantity: number; sku: string } } };
    expect(entry.req.body.quantity).toBe(5);
    expect(entry.req.body.sku).toBe('ABC');
  });
});
