// Browser-side Sentry init. Loads automatically via @sentry/nextjs at
// runtime; do not import this file from app code. NEXT_PUBLIC_ prefix
// is REQUIRED so the DSN ships to the browser bundle.
//
// No DSN configured → init is a no-op (Sentry SDK returns early).

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_STOREFRONT;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
      process.env.NODE_ENV ??
      'development',
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    // Performance tracing is handled by the backend OTel pipeline; the
    // browser tracer here only collects navigation timings for triage,
    // sampled low to keep the free-tier quota intact.
    tracesSampleRate: 0.1,
    // Session replay is disabled — the storefront handles payment data
    // and replay capture risks logging PII before we redact.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
