import type { Currency } from '@jcool/contracts';
import { err, ok, type Result } from './common/result.js';
import type { CatalogError } from './catalog-error.js';
import type { Sku } from './sku.entity.js';
import type { SkuPrice } from './sku-price.entity.js';

export interface ProductProps {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  images: string[];
  isActive: boolean;
  skus: Sku[];
}

export interface ProductInvariantOptions {
  defaultCurrency?: Currency;
}

const DEFAULT_CURRENCY: Currency = 'USD';

export class Product {
  private constructor(private readonly props: ProductProps) {}

  get id(): string {
    return this.props.id;
  }
  get slug(): string {
    return this.props.slug;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string {
    return this.props.description;
  }
  get categoryId(): string {
    return this.props.categoryId;
  }
  get images(): string[] {
    return [...this.props.images];
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get skus(): Sku[] {
    return [...this.props.skus];
  }

  static rehydrate(props: ProductProps): Product {
    return new Product(props);
  }

  static create(
    props: ProductProps,
    options: ProductInvariantOptions = {},
  ): Result<Product, CatalogError> {
    const defaultCurrency = options.defaultCurrency ?? DEFAULT_CURRENCY;

    if (props.skus.length === 0) {
      return err({ kind: 'PRODUCT_MISSING_SKUS' });
    }

    for (const sku of props.skus) {
      if (!sku.hasCurrency(defaultCurrency)) {
        return err({
          kind: 'SKU_MISSING_DEFAULT_CURRENCY_PRICE',
          currency: defaultCurrency,
        });
      }
    }

    return ok(new Product(props));
  }

  /**
   * Returns the price for the first SKU in the chosen currency.
   * Storefront list-views use this as the "from" price.
   */
  priceFor(currency: Currency): SkuPrice | null {
    for (const sku of this.props.skus) {
      const price = sku.priceFor(currency);
      if (price) return price;
    }
    return null;
  }
}
