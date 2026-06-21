import type { Currency } from '@jcool/contracts';
import { err, ok, type Result } from './common/result.js';
import type { CatalogError } from './catalog-error.js';

export interface SkuPriceProps {
  skuId: string;
  currency: Currency;
  unitAmount: number;
}

export class SkuPrice {
  private constructor(private readonly props: SkuPriceProps) {}

  get skuId(): string {
    return this.props.skuId;
  }
  get currency(): Currency {
    return this.props.currency;
  }
  get unitAmount(): number {
    return this.props.unitAmount;
  }

  static rehydrate(props: SkuPriceProps): SkuPrice {
    return new SkuPrice(props);
  }

  static create(props: SkuPriceProps): Result<SkuPrice, CatalogError> {
    if (!Number.isInteger(props.unitAmount)) {
      return err({ kind: 'INVALID_PRICE', reason: 'NON_INTEGER' });
    }
    if (props.unitAmount < 0) {
      return err({ kind: 'INVALID_PRICE', reason: 'NEGATIVE' });
    }
    return ok(new SkuPrice(props));
  }

  toJSON(): SkuPriceProps {
    return { ...this.props };
  }
}
