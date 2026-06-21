import { err, ok, type Result } from '../../domain/common/result.js';
import type { CatalogError } from '../../domain/catalog-error.js';
import type { ProductRepository } from '../../domain/ports/product.repository.js';
import {
  PRODUCT_INDEXED_ROUTING_KEY,
  buildProductIndexedV1,
} from '../../domain/events/product-indexed.event.js';

export interface DeleteProductInput {
  productId: string;
}

export class DeleteProductUseCase {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: DeleteProductInput): Promise<Result<{ deleted: true }, CatalogError>> {
    const existing = await this.products.findById(input.productId);
    if (!existing) return err({ kind: 'PRODUCT_NOT_FOUND', productId: input.productId });

    const event = buildProductIndexedV1(input.productId, 'DELETE');
    await this.products.delete(input.productId, [
      { routingKey: PRODUCT_INDEXED_ROUTING_KEY, payload: event },
    ]);
    return ok({ deleted: true });
  }
}
