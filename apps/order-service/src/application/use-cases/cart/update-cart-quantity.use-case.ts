import { Cart } from '../../../domain/cart.entity.js';
import { err, isErr, ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import type { CartRepository } from '../../../domain/ports/cart.repository.js';
import type { CatalogClient } from '../../../domain/ports/catalog.client.port.js';

export interface UpdateCartQuantityInput {
  sessionKey: string;
  skuId: string;
  quantity: number;
}

export class UpdateCartQuantityUseCase {
  constructor(
    private readonly carts: CartRepository,
    private readonly catalog: CatalogClient,
  ) {}

  async execute(input: UpdateCartQuantityInput): Promise<Result<Cart, OrderError>> {
    const cart = await this.carts.findBySessionKey(input.sessionKey);
    if (!cart) return err({ kind: 'CART_NOT_FOUND', sessionKey: input.sessionKey });

    // Stock check on increase. Skip catalog hit for decrease/remove.
    if (input.quantity > 0 && cart.currency) {
      const existing = cart.items.find((i) => i.skuId === input.skuId);
      if (!existing) return err({ kind: 'CART_ITEM_NOT_FOUND', skuId: input.skuId });
      const delta = input.quantity - existing.quantity;
      if (delta > 0) {
        const sku = await this.catalog.getSku({
          skuId: input.skuId,
          productId: existing.productId,
          currency: cart.currency,
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
      }
    }

    const updated = cart.updateQuantity(input.skuId, input.quantity);
    if (isErr(updated)) return updated;

    await this.carts.save(cart);
    return ok(cart);
  }
}
