import { err, isErr, ok, type Result } from '../../domain/common/result.js';
import type { CatalogError } from '../../domain/catalog-error.js';
import { Product } from '../../domain/product.entity.js';
import type { ProductRepository } from '../../domain/ports/product.repository.js';
import type { CategoryRepository } from '../../domain/ports/category.repository.js';
import {
  PRODUCT_INDEXED_ROUTING_KEY,
  buildProductIndexedV1,
} from '../../domain/events/product-indexed.event.js';

export interface UpdateProductInput {
  productId: string;
  slug?: string;
  name?: string;
  description?: string;
  categoryId?: string;
  images?: string[];
  isActive?: boolean;
}

export class UpdateProductUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(input: UpdateProductInput): Promise<Result<Product, CatalogError>> {
    const existing = await this.products.findById(input.productId);
    if (!existing) return err({ kind: 'PRODUCT_NOT_FOUND', productId: input.productId });

    const categoryId = input.categoryId ?? existing.categoryId;
    if (input.categoryId && input.categoryId !== existing.categoryId) {
      const cat = await this.categories.findById(input.categoryId);
      if (!cat) return err({ kind: 'CATEGORY_NOT_FOUND', categoryId: input.categoryId });
    }

    const updated = Product.create({
      id: existing.id,
      slug: input.slug ?? existing.slug,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      categoryId,
      images: input.images ?? existing.images,
      isActive: input.isActive ?? existing.isActive,
      skus: existing.skus,
    });
    if (isErr(updated)) return updated;

    const event = buildProductIndexedV1(updated.value.id, 'UPSERT');
    await this.products.saveMetadata(updated.value, [
      { routingKey: PRODUCT_INDEXED_ROUTING_KEY, payload: event },
    ]);

    return ok(updated.value);
  }
}
