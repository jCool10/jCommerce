import { describe, it, expect } from 'vitest';
import { buildProductDocument } from '../src/modules/search/product-document.js';
import type { CatalogProduct } from '../src/modules/catalog/catalog-product.dto.js';

function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'macbook-pro-14',
    name: 'MacBook Pro 14',
    description: 'M3 Pro',
    categoryId: '00000000-0000-4000-8000-0000000000c0',
    images: ['https://cdn.example.com/mbp14.jpg'],
    isActive: true,
    skus: [
      {
        id: '00000000-0000-4000-8000-000000000a01',
        sku: 'MBP14-512',
        prices: [{ currency: 'USD', amount: 199900 }],
        stock: 5,
        attributes: {},
      },
      {
        id: '00000000-0000-4000-8000-000000000a02',
        sku: 'MBP14-1TB',
        prices: [{ currency: 'USD', amount: 249900 }],
        stock: 0,
        attributes: {},
      },
    ],
    ...overrides,
  };
}

describe('buildProductDocument', () => {
  it('returns null when both currency projections are missing', () => {
    expect(buildProductDocument({ usd: null, vnd: null, indexedAt: '' })).toBeNull();
  });

  it('takes the lowest SKU price per currency', () => {
    const usd = makeProduct();
    const [firstSku, secondSku] = usd.skus;
    if (!firstSku || !secondSku) throw new Error('fixture invariant');
    const vnd = makeProduct({
      skus: [
        {
          id: firstSku.id,
          sku: firstSku.sku,
          prices: [{ currency: 'VND', amount: 50_000_000 }],
          stock: 5,
          attributes: {},
        },
        {
          id: secondSku.id,
          sku: secondSku.sku,
          prices: [{ currency: 'VND', amount: 60_000_000 }],
          stock: 0,
          attributes: {},
        },
      ],
    });
    const doc = buildProductDocument({ usd, vnd, indexedAt: '2026-06-17T00:00:00Z' });
    expect(doc?.priceUsd).toBe(199900);
    expect(doc?.priceVnd).toBe(50_000_000);
  });

  it('marks inStock true when any SKU has stock > 0', () => {
    const doc = buildProductDocument({
      usd: makeProduct(),
      vnd: null,
      indexedAt: '2026-06-17T00:00:00Z',
    });
    expect(doc?.inStock).toBe(true);
  });

  it('marks inStock false when all SKUs are out of stock', () => {
    const allOut = makeProduct({
      skus: [
        {
          id: '00000000-0000-4000-8000-000000000a99',
          sku: 'X',
          prices: [{ currency: 'USD', amount: 100 }],
          stock: 0,
          attributes: {},
        },
      ],
    });
    const doc = buildProductDocument({ usd: allOut, vnd: null, indexedAt: '' });
    expect(doc?.inStock).toBe(false);
  });

  it('handles missing VND projection by leaving priceVnd null', () => {
    const doc = buildProductDocument({
      usd: makeProduct(),
      vnd: null,
      indexedAt: '2026-06-17T00:00:00Z',
    });
    expect(doc?.priceUsd).toBe(199900);
    expect(doc?.priceVnd).toBeNull();
  });
});
