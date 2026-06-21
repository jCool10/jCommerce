import nestjs from '@jcool/eslint-config/nestjs.js';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nestjs,
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'prisma/migrations/**'],
  },
];
