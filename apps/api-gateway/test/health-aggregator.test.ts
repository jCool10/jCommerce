import { describe, expect, it, vi } from 'vitest';
import { HealthAggregator, type HealthCheckFn } from '../src/modules/health/health-aggregator.js';
import { HealthController } from '../src/modules/health/health.controller.js';

const urls = {
  auth: 'http://auth:3001',
  catalog: 'http://catalog:3002',
  order: 'http://order:3004',
  search: 'http://search:3003',
};

describe('HealthAggregator', () => {
  it('marks gateway up when every downstream is up', async () => {
    const check: HealthCheckFn = vi.fn(async () => true);
    const agg = new HealthAggregator(urls, check, 200);
    const result = await agg.check();
    expect(result.status).toBe('up');
    expect(result.services.auth).toBe('up');
    expect(result.services.catalog).toBe('up');
    expect(result.services.order).toBe('up');
    expect(result.services.search).toBe('up');
  });

  it('marks gateway degraded when at least one downstream is down', async () => {
    const check: HealthCheckFn = vi.fn(async (url: string) => !url.includes('catalog'));
    const agg = new HealthAggregator(urls, check, 200);
    const result = await agg.check();
    expect(result.status).toBe('degraded');
    expect(result.services.catalog).toBe('down');
    expect(result.services.auth).toBe('up');
  });

  it('treats thrown errors and timeouts as down', async () => {
    const check: HealthCheckFn = vi.fn(async () => {
      throw new Error('timeout');
    });
    const agg = new HealthAggregator(urls, check, 200);
    const result = await agg.check();
    expect(result.status).toBe('degraded');
    expect(result.services.auth).toBe('down');
  });

  it('probes each downstream /health URL', async () => {
    const seen: string[] = [];
    const check: HealthCheckFn = vi.fn(async (url: string) => {
      seen.push(url);
      return true;
    });
    const agg = new HealthAggregator(urls, check, 200);
    await agg.check();
    expect(seen.sort()).toEqual([
      'http://auth:3001/health',
      'http://catalog:3002/health',
      'http://order:3004/health',
      'http://search:3003/health',
    ]);
  });
});

describe('HealthController.health', () => {
  function mockRes(): {
    res: Parameters<HealthController['health']>[0];
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  } {
    const json = vi.fn().mockReturnThis();
    const status = vi.fn().mockReturnThis();
    const res = { status, json } as unknown as Parameters<HealthController['health']>[0];
    return { res, status, json };
  }

  it('returns 200 when every downstream is up', async () => {
    const agg = {
      check: vi.fn().mockResolvedValue({ status: 'up', services: { auth: 'up' } }),
    } as unknown as HealthAggregator;
    const ctrl = new HealthController(agg);
    const { res, status, json } = mockRes();
    await ctrl.health(res);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ gateway: 'up', status: 'up' }));
  });

  it('returns 503 when at least one downstream is down', async () => {
    const agg = {
      check: vi.fn().mockResolvedValue({ status: 'degraded', services: { auth: 'up', order: 'down' } }),
    } as unknown as HealthAggregator;
    const ctrl = new HealthController(agg);
    const { res, status, json } = mockRes();
    await ctrl.health(res);
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ gateway: 'up', status: 'degraded' }));
  });
});
