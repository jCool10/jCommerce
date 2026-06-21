import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts', 'test/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
  resolve: {
    alias: {
      // Mirror tsconfig paths so imports using `@/` resolve in tests.
      '@': path.resolve(__dirname, '.'),
      // next/navigation uses Next.js runtime internals (redirect throws a
      // special symbol); swap it for a lightweight stub in the test env.
      'next/navigation': path.resolve(__dirname, '__mocks__/next-navigation.ts'),
    },
  },
});
