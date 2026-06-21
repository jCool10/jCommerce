import { type DynamicModule, type Provider } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import type { Logger as PinoLogger } from 'pino';
import { createLogger } from '../logger/pino-factory.js';
import { CorrelationInterceptor } from './correlation-interceptor.js';
import { MetricsController } from './metrics-controller.js';
import { HttpMetricsInterceptor } from './http-metrics-interceptor.js';
import { initMetrics } from '../metrics/metrics-registry.js';

export interface ObservabilityModuleOptions {
  /** Logical service name stamped on all logs + the `service` Prometheus label. */
  service: string;
  /** Optionally inject a pre-built Pino instance (e.g. for tests). */
  logger?: PinoLogger;
  /** Disable the global correlation interceptor (CLI commands). */
  disableCorrelation?: boolean;
  /** Disable the `/metrics` controller (worker-only processes). */
  disableMetricsEndpoint?: boolean;
}

export const PINO_LOGGER = Symbol('JCOOL_PINO_LOGGER');
export const OBSERVABILITY_SERVICE_NAME = Symbol('JCOOL_OBSERVABILITY_SERVICE');

/**
 * Single import point every service uses to wire structured logging,
 * correlation context, and Prometheus metrics. Tracing init happens
 * separately in `main.ts` BEFORE NestJS bootstrap (see tracing/sdk).
 *
 * Usage:
 *   imports: [ObservabilityModule.forRoot({ service: 'auth-service' })]
 */
export class ObservabilityModule {
  static forRoot(opts: ObservabilityModuleOptions): DynamicModule {
    const logger = opts.logger ?? createLogger({ service: opts.service });
    initMetrics(opts.service);

    const providers: Provider[] = [
      { provide: PINO_LOGGER, useValue: logger },
      { provide: OBSERVABILITY_SERVICE_NAME, useValue: opts.service },
    ];
    const controllers = opts.disableMetricsEndpoint ? [] : [MetricsController];

    if (!opts.disableCorrelation) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: CorrelationInterceptor,
      });
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: HttpMetricsInterceptor,
      });
    }

    return {
      module: ObservabilityModule,
      global: true,
      controllers,
      providers,
      exports: [PINO_LOGGER, OBSERVABILITY_SERVICE_NAME],
    };
  }
}
