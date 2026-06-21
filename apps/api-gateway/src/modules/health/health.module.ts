import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'undici';
import { HealthAggregator, type HealthCheckFn } from './health-aggregator.js';
import { HealthController } from './health.controller.js';
import { PROXY_OPTIONS } from '../proxy/proxy.service.js';
import type { ProxyOptions } from '../proxy/proxy.service.js';
import { ProxyModule } from '../proxy/proxy.module.js';

const probe: HealthCheckFn = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await request(url, { method: 'GET', signal: controller.signal });
    res.body.resume();
    return res.statusCode >= 200 && res.statusCode < 500;
  } finally {
    clearTimeout(timer);
  }
};

@Module({
  imports: [ProxyModule],
  controllers: [HealthController],
  providers: [
    {
      provide: HealthAggregator,
      inject: [ConfigService, PROXY_OPTIONS],
      useFactory: (config: ConfigService, opts: ProxyOptions): HealthAggregator => {
        return new HealthAggregator(
          {
            auth: config.getOrThrow<string>('AUTH_SERVICE_URL'),
            catalog: config.getOrThrow<string>('CATALOG_SERVICE_URL'),
            order: config.getOrThrow<string>('ORDER_SERVICE_URL'),
            search: config.getOrThrow<string>('SEARCH_SERVICE_URL'),
          },
          probe,
          Math.min(opts.headersTimeoutMs, 2000),
        );
      },
    },
  ],
})
export class HealthModule {}
