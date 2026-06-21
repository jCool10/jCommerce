import type { Currency } from '@jcool/contracts';
import { err, ok, type Result } from './common/result.js';
import type { CatalogError } from './catalog-error.js';
import type { SkuPrice } from './sku-price.entity.js';

export interface SkuProps {
  id: string;
  productId: string;
  sku: string;
  attributes: Record<string, string>;
  prices: SkuPrice[];
  // Read-model field — populated by query use cases that join inventory.
  // Optional because write-side use cases (Create/Update) don't need it.
  available?: number;
}

export class Sku {
  private constructor(private readonly props: SkuProps) {}

  get id(): string {
    return this.props.id;
  }
  get productId(): string {
    return this.props.productId;
  }
  get code(): string {
    return this.props.sku;
  }
  get attributes(): Record<string, string> {
    return { ...this.props.attributes };
  }
  get prices(): SkuPrice[] {
    return [...this.props.prices];
  }
  get available(): number | undefined {
    return this.props.available;
  }

  static rehydrate(props: SkuProps): Sku {
    return new Sku(props);
  }

  static create(props: SkuProps): Result<Sku, CatalogError> {
    const seen = new Set<Currency>();
    for (const price of props.prices) {
      if (seen.has(price.currency)) {
        return err({ kind: 'SKU_DUPLICATE_PRICE_CURRENCY', currency: price.currency });
      }
      seen.add(price.currency);
    }
    return ok(new Sku(props));
  }

  withAvailable(available: number): Sku {
    return new Sku({ ...this.props, available });
  }

  priceFor(currency: Currency): SkuPrice | null {
    return this.props.prices.find((p) => p.currency === currency) ?? null;
  }

  hasCurrency(currency: Currency): boolean {
    return this.priceFor(currency) !== null;
  }
}
