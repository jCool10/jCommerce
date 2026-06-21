import { err, ok, type Result } from '../../src/domain/common/result.js';
import type { OrderError } from '../../src/domain/order-error.js';
import type {
  CatalogClient,
  CatalogSkuView,
  GetSkuRequest,
  ReserveInventoryRequest,
} from '../../src/domain/ports/catalog.client.port.js';
import type { Currency } from '@jcool/contracts';

interface SkuSeed {
  skuId: string;
  productId: string;
  productName: string;
  prices: Partial<Record<Currency, number>>;
  available: number;
}

/**
 * Configurable test double for the catalog HTTP client. Saga tests use the
 * helpers `seedSku`, `setReserveOutcome`, etc. to script catalog behaviour
 * (success, insufficient stock, transport failure) without touching HTTP.
 */
export class FakeCatalogClient implements CatalogClient {
  private skus = new Map<string, SkuSeed>();
  private reserveOutcome: Result<void, OrderError> = ok(undefined);
  private releaseOutcome: Result<void, OrderError> = ok(undefined);
  readonly reserveCalls: ReserveInventoryRequest[] = [];
  readonly releaseCalls: string[] = [];

  seedSku(seed: SkuSeed): this {
    this.skus.set(seed.skuId, seed);
    return this;
  }

  setReserveOutcome(outcome: Result<void, OrderError>): this {
    this.reserveOutcome = outcome;
    return this;
  }

  setReleaseOutcome(outcome: Result<void, OrderError>): this {
    this.releaseOutcome = outcome;
    return this;
  }

  async getSku(req: GetSkuRequest): Promise<Result<CatalogSkuView, OrderError>> {
    const sku = this.skus.get(req.skuId);
    if (!sku) return err({ kind: 'SKU_NOT_FOUND', skuId: req.skuId });
    const unitAmount = sku.prices[req.currency];
    if (unitAmount === undefined) {
      return err({ kind: 'SKU_PRICE_MISSING', skuId: req.skuId, currency: req.currency });
    }
    return ok({
      skuId: sku.skuId,
      productId: sku.productId,
      productName: sku.productName,
      unitAmount,
      currency: req.currency,
      available: sku.available,
    });
  }

  async reserveInventory(req: ReserveInventoryRequest): Promise<Result<void, OrderError>> {
    this.reserveCalls.push(req);
    return this.reserveOutcome;
  }

  async releaseInventory(orderId: string): Promise<Result<void, OrderError>> {
    this.releaseCalls.push(orderId);
    return this.releaseOutcome;
  }
}
