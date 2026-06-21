import { describe, expect, it } from 'vitest';
import { ServiceRegistry } from '../src/modules/proxy/service-registry.js';

const urls = {
  auth: 'http://auth:3001',
  catalog: 'http://catalog:3002',
  order: 'http://order:3004',
  search: 'http://search:3003',
};

describe('ServiceRegistry.resolve', () => {
  const reg = new ServiceRegistry(urls);

  it.each([
    ['auth', urls.auth],
    ['catalog', urls.catalog],
    ['products', urls.catalog],
    ['orders', urls.order],
    ['checkout', urls.order],
    ['cart', urls.order],
    ['search', urls.search],
  ])('routes %s to %s', (prefix, expected) => {
    expect(reg.resolve(prefix)).toBe(expected);
  });

  it('returns null for unknown prefix', () => {
    expect(reg.resolve('unknown')).toBeNull();
    expect(reg.resolve('')).toBeNull();
  });
});
