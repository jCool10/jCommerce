import type { Currency } from '@jcool/contracts';
import { Cart } from '../../../domain/cart.entity.js';
import { err, isErr, ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import type { CartRepository } from '../../../domain/ports/cart.repository.js';
import type { CatalogClient } from '../../../domain/ports/catalog.client.port.js';

export interface AddToCartInput {
  sessionKey: string;
  skuId: string;
  productId: string;
  quantity: number;
  currency: Currency;
}

export class AddToCartUseCase {
  constructor(
    private readonly carts: CartRepository,
    private readonly catalog: CatalogClient,
  ) {}

  async execute(input: AddToCartInput): Promise<Result<Cart, OrderError>> {
    // Validate SKU + currency price exist + stock available BEFORE touching cart.
    const sku = await this.catalog.getSku({
      skuId: input.skuId,
      productId: input.productId,
      currency: input.currency,
    });
    if (isErr(sku)) return sku;
    if (sku.value.available < input.quantity) {
      return err({
        kind: 'INSUFFICIENT_STOCK',
        skuId: input.skuId,
        requested: input.quantity,
        available: sku.value.available,
      });
    }

    const cart =
      (await this.carts.findBySessionKey(input.sessionKey)) ??
      Cart.empty(input.sessionKey);

    const added = cart.addItem({
      skuId: input.skuId,
      productId: input.productId,
      quantity: input.quantity,
      currency: input.currency,
    });
    if (isErr(added)) return added;

    await this.carts.save(cart);
    return ok(cart);
  }
}
