'use client';

import { useState, useTransition } from 'react';
import { Check, ShoppingBag } from 'lucide-react';
import type { Currency, Product } from '@jcool/contracts';
import { useCartMutations } from '@/lib/hooks/use-cart-mutations';
import { pickPrimarySku } from '@/lib/product-pricing';
import { Button } from './ui/button';

interface AddToCartButtonProps {
  product: Product;
  currency: Currency;
  /** Override the SKU to add. Defaults to the first one priced in `currency`. */
  selectedSkuId?: string;
}

export function AddToCartButton({
  product,
  currency,
  selectedSkuId,
}: AddToCartButtonProps): JSX.Element {
  const { add } = useCartMutations();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const primary = pickPrimarySku(product, currency);

  // Resolve the SKU to purchase: explicit selection wins when it is priced
  // in `currency`; otherwise fall back to the primary priced SKU.
  const explicitSku = selectedSkuId
    ? product.skus.find((s) => s.id === selectedSkuId)
    : undefined;
  const explicitPriced = explicitSku?.prices.find((p) => p.currency === currency);
  const target = explicitPriced
    ? { skuId: explicitSku!.id, unitAmount: explicitPriced.amount, stock: explicitSku!.stock }
    : primary
      ? {
          skuId: primary.skuId,
          unitAmount: primary.unitAmount,
          stock: product.skus.find((s) => s.id === primary.skuId)?.stock ?? 0,
        }
      : null;

  if (!target) {
    return (
      <div
        role="status"
        className="rounded-md border border-warning-500/40 bg-warning-100/40 px-4 py-3 text-sm text-warning-600"
      >
        Not priced in {currency}. Switch currency from the header to purchase.
      </div>
    );
  }

  const soldOut = target.stock === 0;

  const handleClick = (): void => {
    if (soldOut) return;
    setState('idle');
    setErrorMsg(null);
    startTransition(() => {
      void add({
        productId: product.id,
        skuId: target.skuId,
        quantity: 1,
        currency,
      })
        .then(() => {
          setState('success');
          setTimeout(() => setState('idle'), 2200);
        })
        .catch((error: unknown) => {
          setState('error');
          setErrorMsg(error instanceof Error ? error.message : 'Add failed');
        });
    });
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleClick}
        loading={pending}
        disabled={soldOut}
        size="xl"
        fullWidth
        leadingIcon={
          state === 'success' ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />
        }
      >
        {soldOut
          ? 'Sold out'
          : state === 'success'
            ? 'Added to cart'
            : 'Add to cart'}
      </Button>
      {errorMsg ? (
        <p role="alert" className="text-xs text-danger-500">
          {errorMsg}
        </p>
      ) : null}
    </div>
  );
}
