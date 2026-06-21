'use client';

import { useMemo, useState } from 'react';
import type { Currency, Product } from '@jcool/contracts';
import { formatMoney } from '@/lib/money';
import { AddToCartButton } from './add-to-cart-button';
import { VariantSelector } from './variant-selector';

interface PdpBuyBoxProps {
  product: Product;
  currency: Currency;
}

// Client-side buy box — owns the selected SKU, computes its live price
// in the active currency, renders variant chips + add-to-cart.
export function PdpBuyBox({ product, currency }: PdpBuyBoxProps): JSX.Element {
  const purchasableSkus = useMemo(
    () => product.skus.filter((sku) => sku.prices.some((p) => p.currency === currency)),
    [product.skus, currency],
  );

  const defaultSku = purchasableSkus[0] ?? product.skus[0];
  const [selectedSkuId, setSelectedSkuId] = useState<string>(defaultSku?.id ?? '');

  const selected = product.skus.find((s) => s.id === selectedSkuId) ?? defaultSku;
  const selectedPrice = selected?.prices.find((p) => p.currency === currency) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3 border-t border-border pt-5">
        <p className="font-display text-3xl font-semibold tracking-tight text-fg tabular-nums md:text-4xl">
          {selectedPrice ? formatMoney(selectedPrice) : `Not available in ${currency}`}
        </p>
        {selected && selected.stock === 0 ? (
          <span className="text-[11px] font-semibold uppercase tracking-widest text-danger-500">
            Sold out
          </span>
        ) : selected && selected.stock < 5 ? (
          <span className="text-[11px] font-semibold uppercase tracking-widest text-warning-600">
            Only {selected.stock} left
          </span>
        ) : null}
      </div>

      <VariantSelector
        skus={product.skus}
        selectedSkuId={selectedSkuId}
        onSelect={setSelectedSkuId}
      />

      <AddToCartButton
        product={product}
        currency={currency}
        selectedSkuId={selectedSkuId}
      />
    </div>
  );
}
