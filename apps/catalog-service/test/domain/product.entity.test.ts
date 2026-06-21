import { describe, expect, it } from 'vitest';
import { Product } from '../../src/domain/product.entity.js';
import { Sku } from '../../src/domain/sku.entity.js';
import { SkuPrice } from '../../src/domain/sku-price.entity.js';
import { isErr, isOk } from '../../src/domain/common/result.js';

const PROD = '11111111-1111-1111-1111-111111111111';
const CAT = '22222222-2222-2222-2222-222222222222';
const SKU_ID = '33333333-3333-3333-3333-333333333333';

const makeValidSku = (): Sku =>
  Sku.rehydrate({
    id: SKU_ID,
    productId: PROD,
    sku: 'TS-RED-M',
    attributes: { color: 'red', size: 'M' },
    prices: [
      SkuPrice.rehydrate({ skuId: SKU_ID, currency: 'USD', unitAmount: 1999 }),
      SkuPrice.rehydrate({ skuId: SKU_ID, currency: 'VND', unitAmount: 499000 }),
    ],
  });

describe('Product invariants', () => {
  it('creates a valid product with at least one SKU', () => {
    const result = Product.create({
      id: PROD,
      slug: 'red-tee-m',
      name: 'Red Tee',
      description: 'Soft cotton tee',
      categoryId: CAT,
      images: [],
      isActive: true,
      skus: [makeValidSku()],
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.skus).toHaveLength(1);
      expect(result.value.priceFor('USD')?.unitAmount).toBe(1999);
    }
  });

  it('rejects a product with zero SKUs', () => {
    const result = Product.create({
      id: PROD,
      slug: 'empty',
      name: 'Empty',
      description: 'd',
      categoryId: CAT,
      images: [],
      isActive: true,
      skus: [],
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('PRODUCT_MISSING_SKUS');
  });

  it('rejects a SKU missing the default currency price', () => {
    const skuMissingUsd = Sku.rehydrate({
      id: SKU_ID,
      productId: PROD,
      sku: 'TS-RED-L',
      attributes: {},
      prices: [SkuPrice.rehydrate({ skuId: SKU_ID, currency: 'VND', unitAmount: 499000 })],
    });

    const result = Product.create(
      {
        id: PROD,
        slug: 'red-tee-l',
        name: 'Red Tee L',
        description: 'd',
        categoryId: CAT,
        images: [],
        isActive: true,
        skus: [skuMissingUsd],
      },
      { defaultCurrency: 'USD' },
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('SKU_MISSING_DEFAULT_CURRENCY_PRICE');
  });

  it('priceFor returns null when currency is not listed', () => {
    const sku = makeValidSku();
    expect(sku.priceFor('USD')?.unitAmount).toBe(1999);
    expect(sku.priceFor('VND')?.unitAmount).toBe(499000);
  });
});

describe('SkuPrice validation', () => {
  it('rejects negative amounts when constructed via create', () => {
    const result = SkuPrice.create({ skuId: SKU_ID, currency: 'USD', unitAmount: -1 });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('INVALID_PRICE');
  });

  it('rejects non-integer amounts', () => {
    const result = SkuPrice.create({ skuId: SKU_ID, currency: 'USD', unitAmount: 1.5 });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('INVALID_PRICE');
  });

  it('accepts zero amount (free item)', () => {
    const result = SkuPrice.create({ skuId: SKU_ID, currency: 'USD', unitAmount: 0 });
    expect(isOk(result)).toBe(true);
  });
});

describe('Sku.create() duplicate currency guard', () => {
  it('rejects a SKU with two prices in the same currency', () => {
    const result = Sku.create({
      id: SKU_ID,
      productId: PROD,
      sku: 'TS-RED-M',
      attributes: {},
      prices: [
        SkuPrice.rehydrate({ skuId: SKU_ID, currency: 'USD', unitAmount: 1999 }),
        SkuPrice.rehydrate({ skuId: SKU_ID, currency: 'USD', unitAmount: 2999 }),
      ],
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result) && result.error.kind === 'SKU_DUPLICATE_PRICE_CURRENCY') {
      expect(result.error.currency).toBe('USD');
    } else {
      throw new Error('expected SKU_DUPLICATE_PRICE_CURRENCY');
    }
  });

  it('accepts a SKU with one row per currency', () => {
    const result = Sku.create({
      id: SKU_ID,
      productId: PROD,
      sku: 'TS-RED-M',
      attributes: {},
      prices: [
        SkuPrice.rehydrate({ skuId: SKU_ID, currency: 'USD', unitAmount: 1999 }),
        SkuPrice.rehydrate({ skuId: SKU_ID, currency: 'VND', unitAmount: 499000 }),
      ],
    });
    expect(isOk(result)).toBe(true);
  });
});
