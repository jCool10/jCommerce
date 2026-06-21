import base from '@jcool/eslint-config/base.js';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...base,
  {
    // Hard boundary: contracts package MUST NOT depend on domain SDKs.
    // Schemas are vendor-agnostic data shapes only.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'stripe',
                '@elastic/elasticsearch',
                'bullmq',
                'mjml',
                'next-auth',
                '@nestjs/*',
                'amqplib',
                'ioredis',
                '@prisma/*',
                'next',
                'react',
                'react-dom',
              ],
              message: 'contracts package must remain vendor-agnostic; no domain SDK imports.',
            },
          ],
        },
      ],
    },
  },
];
