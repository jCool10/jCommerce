import base from './base.js';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...base,
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
];
