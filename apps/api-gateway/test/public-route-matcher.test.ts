import { describe, expect, it } from 'vitest';
import { isPublicRoute } from '../src/modules/auth/public-route-matcher.js';

describe('isPublicRoute', () => {
  describe('auth endpoints (any method)', () => {
    it.each([
      'POST /api/v1/auth/register',
      'POST /api/v1/auth/login',
      'POST /api/v1/auth/refresh',
    ])('%s is public', (line) => {
      const [method, path] = line.split(' ') as [string, string];
      expect(isPublicRoute(method, path)).toBe(true);
    });
  });

  describe('catalog/search read-only', () => {
    it('GET /api/v1/products is public', () => {
      expect(isPublicRoute('GET', '/api/v1/products')).toBe(true);
    });
    it('GET /api/v1/products/123 is public', () => {
      expect(isPublicRoute('GET', '/api/v1/products/123')).toBe(true);
    });
    it('GET /api/v1/search?q=foo is public', () => {
      expect(isPublicRoute('GET', '/api/v1/search')).toBe(true);
    });
    it('GET /api/v1/search/autocomplete is public', () => {
      expect(isPublicRoute('GET', '/api/v1/search/autocomplete')).toBe(true);
    });
  });

  describe('protected by default', () => {
    it.each([
      'POST /api/v1/products',
      'DELETE /api/v1/products/1',
      'GET /api/v1/orders',
      'POST /api/v1/checkout',
      'GET /api/v1/cart',
      'POST /api/v1/auth/logout',
    ])('%s is protected', (line) => {
      const [method, path] = line.split(' ') as [string, string];
      expect(isPublicRoute(method, path)).toBe(false);
    });
  });

  it('is case-insensitive on HTTP method', () => {
    expect(isPublicRoute('get', '/api/v1/products/1')).toBe(true);
    expect(isPublicRoute('Post', '/api/v1/auth/login')).toBe(true);
  });

  it('ignores query string in path', () => {
    expect(isPublicRoute('GET', '/api/v1/products?currency=USD')).toBe(true);
    expect(isPublicRoute('GET', '/api/v1/search?q=hat&page=2')).toBe(true);
  });

  describe('rejects traversal / smuggling attempts', () => {
    it.each([
      '/api/v1/products/../orders',
      '/api/v1/products/..',
      '/api/v1/products//../../orders',
      '/api/v1/products/%2e%2e/orders',
      '/api/v1/products\\..\\orders',
    ])('%s is NOT public', (path) => {
      expect(isPublicRoute('GET', path)).toBe(false);
    });
  });
});
