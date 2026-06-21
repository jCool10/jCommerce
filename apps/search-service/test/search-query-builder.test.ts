import { describe, it, expect } from 'vitest';
import { buildSearchRequest } from '../src/modules/search/search-query-builder.js';
import type { SearchQuery } from '@jcool/contracts';

const baseQuery: SearchQuery = {
  q: '',
  page: 1,
  pageSize: 20,
  sort: 'relevance',
};

describe('buildSearchRequest', () => {
  it('emits a match_all when q is empty', () => {
    const req = buildSearchRequest('products', baseQuery);
    expect(req.query?.bool?.must).toEqual([{ match_all: {} }]);
    expect(req.from).toBe(0);
    expect(req.size).toBe(20);
  });

  it('applies multi_match with AUTO fuzziness when q is present', () => {
    const req = buildSearchRequest('products', { ...baseQuery, q: 'laptop' });
    const must = req.query?.bool?.must as Array<{ multi_match?: unknown }>;
    const first = must[0];
    if (!first) throw new Error('must clause missing');
    const multi = first.multi_match as { fuzziness?: string; fields?: string[] };
    expect(multi.fuzziness).toBe('AUTO');
    expect(multi.fields).toEqual(['name^3', 'description']);
  });

  it('always filters out inactive products', () => {
    const req = buildSearchRequest('products', baseQuery);
    const filter = req.query?.bool?.filter as Array<{ term?: Record<string, unknown> }>;
    expect(filter.some((f) => f.term?.isActive === true)).toBe(true);
  });

  it('routes price range to the currency-specific field', () => {
    const usd = buildSearchRequest('products', {
      ...baseQuery,
      currency: 'USD',
      minPrice: 100,
      maxPrice: 500,
    });
    const usdFilter = usd.query?.bool?.filter as Array<{ range?: Record<string, unknown> }>;
    expect(usdFilter.find((f) => f.range && 'priceUsd' in f.range)).toBeDefined();

    const vnd = buildSearchRequest('products', {
      ...baseQuery,
      currency: 'VND',
      minPrice: 100_000,
    });
    const vndFilter = vnd.query?.bool?.filter as Array<{ range?: Record<string, unknown> }>;
    expect(vndFilter.find((f) => f.range && 'priceVnd' in f.range)).toBeDefined();
  });

  it('paginates from based on page and pageSize', () => {
    const req = buildSearchRequest('products', { ...baseQuery, page: 3, pageSize: 25 });
    expect(req.from).toBe(50);
    expect(req.size).toBe(25);
  });

  it('honours sort=price_desc with the currency-specific field', () => {
    const req = buildSearchRequest('products', {
      ...baseQuery,
      currency: 'VND',
      sort: 'price_desc',
    });
    expect(req.sort).toEqual([{ priceVnd: { order: 'desc', missing: '_last' } }]);
  });
});
