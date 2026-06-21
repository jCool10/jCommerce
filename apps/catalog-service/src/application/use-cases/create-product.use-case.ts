import { randomUUID } from 'node:crypto';
import type { Currency } from '@jcool/contracts';
import { err, isErr, ok, type Result } from '../../domain/common/result.js';
import type { CatalogError } from '../../domain/catalog-error.js';
import { Product } from '../../domain/product.entity.js';
import { Sku } from '../../domain/sku.entity.js';
import { SkuPrice } from '../../domain/sku-price.entity.js';
import { Inventory } from '../../domain/inventory.entity.js';
import type { ProductRepository } from '../../domain/ports/product.repository.js';
import type { CategoryRepository } from '../../domain/ports/category.repository.js';
import type { InventoryRepository } from '../../domain/ports/inventory.repository.js';
import {
  PRODUCT_INDEXED_ROUTING_KEY,
  buildProductIndexedV1,
} from '../../domain/events/product-indexed.event.js';

export interface CreateProductSkuInput {
  sku: string;
  attributes: Record<string, string>;
  prices: Array<{ currency: Currency; unitAmount: number }>;
  initialStock: number;
}

export interface CreateProductInput {
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  images: string[];
  isActive: boolean;
  skus: CreateProductSkuInput[];
}

export class CreateProductUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
    private readonly inventory: InventoryRepository,
  ) {}

  async execute(input: CreateProductInput): Promise<Result<Product, CatalogError>> {
    const category = await this.categories.findById(input.categoryId);
    if (!category) {
      return err({ kind: 'CATEGORY_NOT_FOUND', categoryId: input.categoryId });
    }

    const productId = randomUUID();
    const skus: Sku[] = [];
    const initialInventory: Inventory[] = [];

    for (const skuInput of input.skus) {
      const skuId = randomUUID();
      const prices: SkuPrice[] = [];
      for (const priceInput of skuInput.prices) {
        const price = SkuPrice.create({
          skuId,
          currency: priceInput.currency,
          unitAmount: priceInput.unitAmount,
        });
        if (isErr(price)) return price;
        prices.push(price.value);
      }
      const skuResult = Sku.create({
        id: skuId,
        productId,
        sku: skuInput.sku,
        attributes: skuInput.attributes,
        prices,
      });
      if (isErr(skuResult)) return skuResult;
      skus.push(skuResult.value);
      initialInventory.push(
        Inventory.rehydrate({
          skuId,
          available: Math.max(0, Math.trunc(skuInput.initialStock)),
          reserved: 0,
        }),
      );
    }

    const productResult = Product.create({
      id: productId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      categoryId: input.categoryId,
      images: input.images,
      isActive: input.isActive,
      skus,
    });
    if (isErr(productResult)) return productResult;

    const product = productResult.value;
    const event = buildProductIndexedV1(product.id, 'UPSERT');

    await this.products.save(product, [
      { routingKey: PRODUCT_INDEXED_ROUTING_KEY, payload: event },
    ]);
    await this.inventory.upsertMany(initialInventory);

    return ok(product);
  }
}
