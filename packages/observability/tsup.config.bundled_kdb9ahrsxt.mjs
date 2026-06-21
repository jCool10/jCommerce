// tsup.config.ts
import { defineConfig } from "tsup";
var tsup_config_default = defineConfig({
  entry: {
    index: "src/index.ts",
    "tracing-bootstrap": "src/tracing/tracing-bootstrap.ts",
    "sentry-init": "src/sentry/sentry-init.ts"
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  // pino + OTel SDK bring in native + dynamic-require flows that confuse
  // bundlers. Keep them external so the consuming app resolves them.
  external: [
    "pino",
    "pino-http",
    "pino-pretty",
    "prom-client",
    "@opentelemetry/api",
    "@opentelemetry/sdk-node",
    "@opentelemetry/auto-instrumentations-node",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/resources",
    "@opentelemetry/semantic-conventions",
    "@opentelemetry/propagator-b3",
    "@sentry/node",
    "@nestjs/common",
    "@nestjs/core",
    "reflect-metadata",
    "rxjs"
  ]
});
export {
  tsup_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidHN1cC5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL2xvY2hvYW5nL0RvY3VtZW50cy8wMV9Xb3JrL1BlcnNvbi9qQ29vbC1lY29tbWVyY2UvcGFja2FnZXMvb2JzZXJ2YWJpbGl0eS90c3VwLmNvbmZpZy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbG9jaG9hbmcvRG9jdW1lbnRzLzAxX1dvcmsvUGVyc29uL2pDb29sLWVjb21tZXJjZS9wYWNrYWdlcy9vYnNlcnZhYmlsaXR5XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9sb2Nob2FuZy9Eb2N1bWVudHMvMDFfV29yay9QZXJzb24vakNvb2wtZWNvbW1lcmNlL3BhY2thZ2VzL29ic2VydmFiaWxpdHkvdHN1cC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd0c3VwJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgZW50cnk6IHtcbiAgICBpbmRleDogJ3NyYy9pbmRleC50cycsXG4gICAgJ3RyYWNpbmctYm9vdHN0cmFwJzogJ3NyYy90cmFjaW5nL3RyYWNpbmctYm9vdHN0cmFwLnRzJyxcbiAgICAnc2VudHJ5LWluaXQnOiAnc3JjL3NlbnRyeS9zZW50cnktaW5pdC50cycsXG4gIH0sXG4gIGZvcm1hdDogWydlc20nLCAnY2pzJ10sXG4gIGR0czogdHJ1ZSxcbiAgc3BsaXR0aW5nOiBmYWxzZSxcbiAgc291cmNlbWFwOiB0cnVlLFxuICBjbGVhbjogdHJ1ZSxcbiAgdHJlZXNoYWtlOiB0cnVlLFxuICB0YXJnZXQ6ICdlczIwMjInLFxuICAvLyBwaW5vICsgT1RlbCBTREsgYnJpbmcgaW4gbmF0aXZlICsgZHluYW1pYy1yZXF1aXJlIGZsb3dzIHRoYXQgY29uZnVzZVxuICAvLyBidW5kbGVycy4gS2VlcCB0aGVtIGV4dGVybmFsIHNvIHRoZSBjb25zdW1pbmcgYXBwIHJlc29sdmVzIHRoZW0uXG4gIGV4dGVybmFsOiBbXG4gICAgJ3Bpbm8nLFxuICAgICdwaW5vLWh0dHAnLFxuICAgICdwaW5vLXByZXR0eScsXG4gICAgJ3Byb20tY2xpZW50JyxcbiAgICAnQG9wZW50ZWxlbWV0cnkvYXBpJyxcbiAgICAnQG9wZW50ZWxlbWV0cnkvc2RrLW5vZGUnLFxuICAgICdAb3BlbnRlbGVtZXRyeS9hdXRvLWluc3RydW1lbnRhdGlvbnMtbm9kZScsXG4gICAgJ0BvcGVudGVsZW1ldHJ5L2V4cG9ydGVyLXRyYWNlLW90bHAtaHR0cCcsXG4gICAgJ0BvcGVudGVsZW1ldHJ5L3Jlc291cmNlcycsXG4gICAgJ0BvcGVudGVsZW1ldHJ5L3NlbWFudGljLWNvbnZlbnRpb25zJyxcbiAgICAnQG9wZW50ZWxlbWV0cnkvcHJvcGFnYXRvci1iMycsXG4gICAgJ0BzZW50cnkvbm9kZScsXG4gICAgJ0BuZXN0anMvY29tbW9uJyxcbiAgICAnQG5lc3Rqcy9jb3JlJyxcbiAgICAncmVmbGVjdC1tZXRhZGF0YScsXG4gICAgJ3J4anMnLFxuICBdLFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTJYLFNBQVMsb0JBQW9CO0FBRXhaLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLE9BQU87QUFBQSxJQUNMLE9BQU87QUFBQSxJQUNQLHFCQUFxQjtBQUFBLElBQ3JCLGVBQWU7QUFBQSxFQUNqQjtBQUFBLEVBQ0EsUUFBUSxDQUFDLE9BQU8sS0FBSztBQUFBLEVBQ3JCLEtBQUs7QUFBQSxFQUNMLFdBQVc7QUFBQSxFQUNYLFdBQVc7QUFBQSxFQUNYLE9BQU87QUFBQSxFQUNQLFdBQVc7QUFBQSxFQUNYLFFBQVE7QUFBQTtBQUFBO0FBQUEsRUFHUixVQUFVO0FBQUEsSUFDUjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
