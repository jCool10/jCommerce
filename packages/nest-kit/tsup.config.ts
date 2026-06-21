import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  // Consuming services own these runtime deps; keep external so a single
  // instance (and decorator/reflect metadata) is shared with the app.
  external: ['@nestjs/common', 'reflect-metadata', 'zod'],
});
