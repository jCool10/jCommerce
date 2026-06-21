import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // SWC preserves @Injectable + DI metadata (vitest's esbuild strips it,
    // breaking NestJS Testing module DI in the integration test).
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/modules/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', '**/*.module.ts'],
    },
  },
});
