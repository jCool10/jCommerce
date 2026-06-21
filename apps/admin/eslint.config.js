import nextjs from '@jcool/eslint-config/nextjs.js';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextjs,
  {
    // Build / config files run in Node — allow node globals so withSentryConfig
    // and friends can read `process.env.SENTRY_AUTH_TOKEN` without no-undef noise.
    files: ['*.config.{js,mjs,cjs,ts}', 'sentry.*.config.{js,ts}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
      },
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'dist/**'],
  },
];
