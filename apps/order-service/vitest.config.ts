import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/application/**/*.ts', 'src/domain/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
    },
  },
});
