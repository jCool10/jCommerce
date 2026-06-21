import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/node', () => {
  return {
    init: vi.fn(),
    close: vi.fn().mockResolvedValue(true),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setTag: vi.fn(),
    setUser: vi.fn(),
    withScope: vi.fn(),
  };
});

import * as Sentry from '@sentry/node';
import {
  initSentry,
  isSentryInitialized,
  __resetSentryForTests,
} from '../src/sentry/sentry-init.js';

describe('initSentry', () => {
  beforeEach(() => {
    __resetSentryForTests();
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.SENTRY_ENVIRONMENT;
    delete process.env.SENTRY_RELEASE;
    delete process.env.GIT_SHA;
  });

  afterEach(() => {
    __resetSentryForTests();
  });

  it('no-ops when no DSN is configured', () => {
    initSentry({ service: 'order-service' });
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(isSentryInitialized()).toBe(false);
  });

  it('initializes Sentry with the expected errors-only config when DSN is set', () => {
    initSentry({
      service: 'auth-service',
      dsn: 'https://abc@sentry.example/123',
      environment: 'staging',
      release: 'sha-123',
    });

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const initOpts = (Sentry.init as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(initOpts).toMatchObject({
      dsn: 'https://abc@sentry.example/123',
      serverName: 'auth-service',
      environment: 'staging',
      release: 'sha-123',
      // Both flags are load-bearing — they keep Sentry from booting a
      // second OTel SDK and from billing for spans we already export.
      skipOpenTelemetrySetup: true,
      tracesSampleRate: 0,
      initialScope: { tags: { service: 'auth-service' } },
    });
    expect(isSentryInitialized()).toBe(true);
  });

  it('is idempotent — a second call is a no-op even with a different DSN', () => {
    initSentry({ service: 'order-service', dsn: 'https://a@s.io/1' });
    initSentry({ service: 'order-service', dsn: 'https://b@s.io/2' });
    expect(Sentry.init).toHaveBeenCalledTimes(1);
  });

  it('reads DSN + environment + release from env when not passed explicitly', () => {
    process.env.SENTRY_DSN = 'https://from-env@sentry.example/9';
    process.env.SENTRY_ENVIRONMENT = 'production';
    process.env.GIT_SHA = 'abc1234';

    initSentry({ service: 'catalog-service' });

    const initOpts = (Sentry.init as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(initOpts).toMatchObject({
      dsn: 'https://from-env@sentry.example/9',
      environment: 'production',
      release: 'abc1234',
    });
  });

  it('swallows init errors so a bad DSN cannot crash boot', () => {
    (Sentry.init as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('bad endpoint');
    });
    expect(() =>
      initSentry({ service: 'search-service', dsn: 'https://x@s.io/1' }),
    ).not.toThrow();
    expect(isSentryInitialized()).toBe(false);
  });
});
