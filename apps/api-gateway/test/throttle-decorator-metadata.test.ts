import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ProxyController } from '../src/modules/proxy/proxy.controller.js';
import {
  THROTTLE_LIMIT_BROWSE,
  THROTTLE_LIMIT_CHECKOUT,
  THROTTLE_LIMIT_LOGIN,
} from '../src/modules/proxy/throttler-limits.js';

/**
 * Locks in the plan-required limits (login 5/15min, checkout 5/min, browse
 * 100/min). The actual @Throttle wiring is exercised by ThrottlerGuard inside
 * @nestjs/throttler — owning the named-limit values here gives us a single
 * place to update when the plan changes them.
 */
describe('throttler-limits constants (override `default` slot per route)', () => {
  it('login: 5 requests / 15 min', () => {
    expect(THROTTLE_LIMIT_LOGIN.default.limit).toBe(5);
    expect(THROTTLE_LIMIT_LOGIN.default.ttl).toBe(15 * 60 * 1000);
  });
  it('checkout: 5 requests / 1 min', () => {
    expect(THROTTLE_LIMIT_CHECKOUT.default.limit).toBe(5);
    expect(THROTTLE_LIMIT_CHECKOUT.default.ttl).toBe(60 * 1000);
  });
  it('browse: 100 requests / 1 min', () => {
    expect(THROTTLE_LIMIT_BROWSE.default.limit).toBe(100);
    expect(THROTTLE_LIMIT_BROWSE.default.ttl).toBe(60 * 1000);
  });
});

describe('ProxyController route methods exist', () => {
  it.each([
    'authLogin',
    'authRefresh',
    'auth',
    'checkout',
    'cartRoot',
    'cart',
    'ordersRoot',
    'orders',
    'catalogRoot',
    'catalog',
    'productsRoot',
    'products',
    'searchRoot',
    'searchTree',
  ])('method %s is declared', (method) => {
    const proto = ProxyController.prototype as unknown as Record<string, unknown>;
    expect(typeof proto[method]).toBe('function');
  });
});
