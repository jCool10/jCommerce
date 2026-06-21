// Edge-runtime Sentry init (middleware + edge routes). Auto-loaded by
// @sentry/nextjs when middleware.ts or an edge handler runs. The edge
// runtime cannot use the Node SDK so we use the @sentry/nextjs edge
// adapter, which mirrors `init`/`captureException` on a smaller core.
//
// No DSN configured → init is a no-op (Sentry SDK returns early).

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN_ADMIN ?? process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ??
      process.env.NODE_ENV ??
      'development',
    release: process.env.SENTRY_RELEASE ?? process.env.GIT_SHA,
    tracesSampleRate: 0.05,
  });
}
