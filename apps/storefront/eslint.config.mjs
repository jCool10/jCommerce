import nextjs from '@jcool/eslint-config/nextjs.js';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextjs,
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**'],
  },
];
