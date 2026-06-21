import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // packages/contracts is a workspace ESM package — transpile so Next can import it
  // without bundling issues during dev or production builds.
  transpilePackages: ['@jcool/contracts'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  experimental: {
    // typedRoutes adds compile-time href validation for <Link> across the app.
    typedRoutes: true,
  },
};

// withSentryConfig is a no-op when SENTRY_DSN isn't set in the runtime
// env (the SDK init in sentry.*.config.ts short-circuits) but it does
// always wrap the build to inject source maps if SENTRY_AUTH_TOKEN is
// present. Keeping the wrapper unconditional means the prod build path
// matches the dev/test path — no separate compile target.
export default withSentryConfig(nextConfig, {
  // Silence the build telemetry banner; we control upload via env.
  silent: !process.env.CI,
  // Only upload source maps when an auth token is present (CI/release
  // pipelines). Local dev never uploads.
  dryRun: !process.env.SENTRY_AUTH_TOKEN,
  // Hide source maps from the public /_next bundle once uploaded.
  hideSourceMaps: true,
  // Tunneling is off — we rely on the storefront's outbound network.
  tunnelRoute: undefined,
});
