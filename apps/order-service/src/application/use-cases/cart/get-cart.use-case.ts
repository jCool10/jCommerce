import type { Currency } from '@jcool/contracts';
import { Cart } from '../../../domain/cart.entity.js';
import { isErr, ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import type { CartRepository } from '../../../domain/ports/cart.repository.js';
import type {
  CatalogClient,
  CatalogSkuView,
} from '../../../domain/ports/catalog.client.port.js';

export interface CartLineView {
  skuId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitAmount: number;
  currency: Currency;
  lineTotal: number;
}

export interface CartView {
  sessionKey: string;
  currency: Currency | null;
  items: CartLineView[];
  subtotalAmount: number;
}

export interface GetCartInput {
  sessionKey: string;
}

export class GetCartUseCase {
  constructor(
    private readonly carts: CartRepository,
    private readonly catalog: CatalogClient,
  ) {}

  /**
   * Hydrates the bare cart (skuId + quantity) with current catalog prices
   * for display. Subtotal is recomputed live so stale Redis state does
   * not show wrong totals. Items whose catalog price is missing are
   * dropped from the view (cart still persists them; storefront warns).
   */
  async execute(input: GetCartInput): Promise<Result<CartView, OrderError>> {
    const cart =
      (await this.carts.findBySessionKey(input.sessionKey)) ??
      Cart.empty(input.sessionKey);
    return this.enrich(cart);
  }

  // Enrich a cart we already hold, skipping a repo re-read. Controllers call
  // this right after a mutation to dodge the read-after-write race.
  async enrich(cart: Cart): Promise<Result<CartView, OrderError>> {
    if (cart.isEmpty() || cart.currency === null) {
      return ok({
        sessionKey: cart.sessionKey,
        currency: cart.currency,
        items: [],
        subtotalAmount: 0,
      });
    }

    const currency = cart.currency;
    const enriched: CartLineView[] = [];
    let subtotal = 0;
    for (const line of cart.items) {
      const skuResult = await this.catalog.getSku({
        skuId: line.skuId,
        productId: line.productId,
        currency,
      });
      if (isErr(skuResult)) continue; // skip; UI warns the user
      const sku: CatalogSkuView = skuResult.value;
      const lineTotal = sku.unitAmount * line.quantity;
      enriched.push({
        skuId: sku.skuId,
        productId: sku.productId,
        productName: sku.productName,
        quantity: line.quantity,
        unitAmount: sku.unitAmount,
        currency,
        lineTotal,
      });
      subtotal += lineTotal;
    }

    return ok({
      sessionKey: cart.sessionKey,
      currency,
      items: enriched,
      subtotalAmount: subtotal,
    });
  }
}
