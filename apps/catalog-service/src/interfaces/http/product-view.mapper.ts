import type { Currency, Money, Product as ProductDto, Sku as SkuDto } from '@jcool/contracts';
import type { Product } from '../../domain/product.entity.js';
import type { Sku } from '../../domain/sku.entity.js';

const toMoney = (currency: Currency, unitAmount: number): Money => ({
  currency,
  amount: unitAmount,
});

const toSkuDto = (sku: Sku): SkuDto => ({
  id: sku.id,
  sku: sku.code,
  attributes: sku.attributes,
  prices: sku.prices.map((p) => toMoney(p.currency, p.unitAmount)) as [Money, ...Money[]],
  // Read-side hydration: List/GetProductUseCase populates Sku.available from
  // InventoryRepository. Write-side mappings (Create/Update responses) won't,
  // so default to 0 — admin UIs read stock from /inventory endpoints.
  stock: sku.available ?? 0,
});

export const toProductDto = (product: Product): ProductDto => ({
  id: product.id,
  slug: product.slug,
  name: product.name,
  description: product.description,
  categoryId: product.categoryId,
  images: product.images,
  isActive: product.isActive,
  skus: product.skus.map((s) => toSkuDto(s)) as [SkuDto, ...SkuDto[]],
});
