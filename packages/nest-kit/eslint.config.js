import base from '@jcool/eslint-config/base.js';

export default [
  ...base,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
];
