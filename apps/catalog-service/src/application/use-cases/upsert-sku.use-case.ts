import { randomUUID } from 'node:crypto';
import type { Currency } from '@jcool/contracts';
import { err, isErr, ok, type Result } from '../../domain/common/result.js';
import type { CatalogError } from '../../domain/catalog-error.js';
import { Product } from '../../domain/product.entity.js';
import { Sku } from '../../domain/sku.entity.js';
import { SkuPrice } from '../../domain/sku-price.entity.js';
import { Inventory } from '../../domain/inventory.entity.js';
import type { ProductRepository } from '../../domain/ports/product.repository.js';
import type { InventoryRepository } from '../../domain/ports/inventory.repository.js';
import {
  PRODUCT_INDEXED_ROUTING_KEY,
  buildProductIndexedV1,
} from '../../domain/events/product-indexed.event.js';

export interface UpsertSkuInput {
  productId: string;
  skuId?: string; // omit to create new
  sku: string;
  attributes: Record<string, string>;
  prices: Array<{ currency: Currency; unitAmount: number }>;
  initialStock?: number;
}

export class UpsertSkuUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly inventory: InventoryRepository,
  ) {}

  async execute(input: UpsertSkuInput): Promise<Result<Sku, CatalogError>> {
    const product = await this.products.findById(input.productId);
    if (!product) return err({ kind: 'PRODUCT_NOT_FOUND', productId: input.productId });

    const skuId = input.skuId ?? randomUUID();
    const prices: SkuPrice[] = [];
    for (const p of input.prices) {
      const result = SkuPrice.create({ skuId, currency: p.currency, unitAmount: p.unitAmount });
      if (isErr(result)) return result;
      prices.push(result.value);
    }

    const skuResult = Sku.create({
      id: skuId,
      productId: input.productId,
      sku: input.sku,
      attributes: input.attributes,
      prices,
    });
    if (isErr(skuResult)) return skuResult;
    const newSku = skuResult.value;

    const merged = input.skuId
      ? product.skus.map((s) => (s.id === input.skuId ? newSku : s))
      : [...product.skus, newSku];

    const updated = Product.create({
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      images: product.images,
      isActive: product.isActive,
      skus: merged,
    });
    if (isErr(updated)) return updated;

    const event = buildProductIndexedV1(product.id, 'UPSERT');
    await this.products.save(updated.value, [
      { routingKey: PRODUCT_INDEXED_ROUTING_KEY, payload: event },
    ]);

    if (!input.skuId && input.initialStock !== undefined) {
      await this.inventory.upsertMany([
        Inventory.rehydrate({
          skuId,
          available: Math.max(0, Math.trunc(input.initialStock)),
          reserved: 0,
        }),
      ]);
    }

    return ok(newSku);
  }
}
