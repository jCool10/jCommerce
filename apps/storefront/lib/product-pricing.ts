import type { Currency, Money, Product } from '@jcool/contracts';

// Storefront-side helper: pick the cheapest SKU price that matches the
// active currency. SKUs without a price in `currency` are skipped — the
// catalog returns multi-currency prices per SKU (no FX fallback).
export function pickFromPrice(product: Product, currency: Currency): Money | null {
  let best: Money | null = null;
  for (const sku of product.skus) {
    for (const price of sku.prices) {
      if (price.currency !== currency) continue;
      if (best === null || price.amount < best.amount) best = price;
    }
  }
  return best;
}

export function pickPrimarySku(product: Product, currency: Currency): {
  skuId: string;
  unitAmount: number;
} | null {
  for (const sku of product.skus) {
    const match = sku.prices.find((p) => p.currency === currency);
    if (match) return { skuId: sku.id, unitAmount: match.amount };
  }
  return null;
}
