// Server-side Sentry init (Node runtime). Auto-loaded by @sentry/nextjs
// during request handling. SENTRY_DSN is a server-only env var so it
// never leaks to the browser bundle.
//
// No DSN configured → init is a no-op (Sentry SDK returns early).

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN_STOREFRONT ?? process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ??
      process.env.NODE_ENV ??
      'development',
    release: process.env.SENTRY_RELEASE ?? process.env.GIT_SHA,
    // Performance tracing is handled by the backend OTel pipeline; the
    // Next.js server tracer here only spans request handlers, sampled
    // low to keep the free-tier quota intact.
    tracesSampleRate: 0.1,
  });
}
