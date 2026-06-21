import type { Currency } from '@jcool/contracts';
import { err, ok, type Result } from '../../domain/common/result.js';
import type { CatalogError } from '../../domain/catalog-error.js';
import { Product } from '../../domain/product.entity.js';
import { Sku } from '../../domain/sku.entity.js';
import type { ProductRepository } from '../../domain/ports/product.repository.js';
import type { InventoryRepository } from '../../domain/ports/inventory.repository.js';

export interface GetProductInput {
  productId: string;
  currency: Currency;
  // Defaults false (public). Admin sets true so the editor can still load a
  // deactivated product. When false, deactivated products are indistinguishable
  // from missing — closing the inactive-product purchase path.
  includeInactive?: boolean;
}

export class GetProductUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly inventory: InventoryRepository,
  ) {}

  async execute(input: GetProductInput): Promise<Result<Product, CatalogError>> {
    const product = await this.products.findById(input.productId);
    if (!product) return err({ kind: 'PRODUCT_NOT_FOUND', productId: input.productId });
    if (!product.isActive && !input.includeInactive) {
      return err({ kind: 'PRODUCT_NOT_FOUND', productId: input.productId });
    }

    const inventoryRows = await this.inventory.findBySkuIds(product.skus.map((s) => s.id));
    const stockBySkuId = new Map(inventoryRows.map((inv) => [inv.skuId, inv.available]));

    const projected = projectForCurrency(product, input.currency, stockBySkuId);
    if (projected.skus.some((s) => s.prices.length === 0)) {
      return err({
        kind: 'SKU_MISSING_DEFAULT_CURRENCY_PRICE',
        currency: input.currency,
      });
    }
    return ok(projected);
  }
}

const projectForCurrency = (
  product: Product,
  currency: Currency,
  stockBySkuId: Map<string, number>,
): Product =>
  Product.rehydrate({
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    images: product.images,
    isActive: product.isActive,
    skus: product.skus.map((sku) => {
      const price = sku.priceFor(currency);
      return Sku.rehydrate({
        id: sku.id,
        productId: sku.productId,
        sku: sku.code,
        attributes: sku.attributes,
        prices: price ? [price] : [],
        available: stockBySkuId.get(sku.id) ?? 0,
      });
    }),
  });
