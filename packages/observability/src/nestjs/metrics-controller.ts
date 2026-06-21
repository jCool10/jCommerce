import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { getRegistry } from '../metrics/metrics-registry.js';

/**
 * Prometheus scrape target. Two opt-outs are required so the final URL is
 * exactly `/metrics`:
 *   1. `version: VERSION_NEUTRAL` skips the URI version segment added by
 *      `app.enableVersioning({ prefix: 'v', defaultVersion: '1' })`.
 *   2. main.ts excludes `metrics` from `setGlobalPrefix('api', ...)`.
 * Without (1) the route would resolve to `/v1/metrics` and Prometheus
 * scrapes would 404 on every NestJS service.
 */
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    return getRegistry().metrics();
  }
}
