import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@jcool/contracts'],
  experimental: {
    typedRoutes: false,
  },
};

// withSentryConfig is a no-op when SENTRY_DSN isn't set in the runtime
// env (the SDK init in sentry.*.config.ts short-circuits) but it does
// always wrap the build to inject source maps if SENTRY_AUTH_TOKEN is
// present. Keeping the wrapper unconditional means the prod build path
// matches the dev/test path — no separate compile target.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  dryRun: !process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
  tunnelRoute: undefined,
});
