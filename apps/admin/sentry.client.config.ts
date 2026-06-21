// Browser-side Sentry init. Loads automatically via @sentry/nextjs at
// runtime; do not import this file from app code. NEXT_PUBLIC_ prefix
// is REQUIRED so the DSN ships to the browser bundle.
//
// No DSN configured → init is a no-op (Sentry SDK returns early).

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_ADMIN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
      process.env.NODE_ENV ??
      'development',
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    // Admin UI is internal — lower sample rate is fine.
    tracesSampleRate: 0.05,
    // Replay disabled — admin pages display customer PII.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
