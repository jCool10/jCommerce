import type { Currency } from '@jcool/contracts';
import { err, ok, type Result } from '../../domain/common/result.js';
import type { CatalogError } from '../../domain/catalog-error.js';
import { Product } from '../../domain/product.entity.js';
import { Sku } from '../../domain/sku.entity.js';
import type { ProductRepository } from '../../domain/ports/product.repository.js';
import type { InventoryRepository } from '../../domain/ports/inventory.repository.js';

export interface ListProductsInput {
  limit: number;
  cursor?: string;
  categoryId?: string;
  isActive?: boolean;
  search?: string;
  currency: Currency;
}

export interface ListProductsSuccess {
  items: Product[];
  nextCursor: string | null;
}

const MAX_LIMIT = 100;

export class ListProductsUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly inventory: InventoryRepository,
  ) {}

  async execute(input: ListProductsInput): Promise<Result<ListProductsSuccess, CatalogError>> {
    const limit = Math.min(Math.max(1, Math.trunc(input.limit)), MAX_LIMIT);
    const page = await this.products.list(
      {
        categoryId: input.categoryId,
        isActive: input.isActive,
        search: input.search,
      },
      { limit, cursor: input.cursor },
    );

    const allSkuIds = page.items.flatMap((p) => p.skus.map((s) => s.id));
    const inventoryRows = await this.inventory.findBySkuIds(allSkuIds);
    const stockBySkuId = new Map(inventoryRows.map((inv) => [inv.skuId, inv.available]));

    const items = page.items.map((p) => projectForCurrency(p, input.currency, stockBySkuId));
    for (const item of items) {
      // Storefront cannot render a product priced in a currency it asked for
      // and didn't get. Surface as a domain error so the controller maps 404/409.
      if (item.skus.some((s) => s.prices.length === 0)) {
        return err({ kind: 'SKU_MISSING_DEFAULT_CURRENCY_PRICE', currency: input.currency });
      }
    }
    return ok({ items, nextCursor: page.nextCursor });
  }
}

const projectForCurrency = (
  product: Product,
  currency: Currency,
  stockBySkuId: Map<string, number>,
): Product => {
  const projectedSkus = product.skus.map((sku) => {
    const price = sku.priceFor(currency);
    return Sku.rehydrate({
      id: sku.id,
      productId: sku.productId,
      sku: sku.code,
      attributes: sku.attributes,
      prices: price ? [price] : [],
      available: stockBySkuId.get(sku.id) ?? 0,
    });
  });

  return Product.rehydrate({
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    images: product.images,
    isActive: product.isActive,
    skus: projectedSkus,
  });
};
