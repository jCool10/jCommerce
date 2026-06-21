'use client';

import { useState } from 'react';
import type { Currency } from '@jcool/contracts';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { useCurrencyStore } from '@/lib/store/currency-store';
import { useCartStore } from '@/lib/store/cart-store';
import { useCartMutations } from '@/lib/hooks/use-cart-mutations';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { cn } from '@/lib/cn';

// Segmented control — sharp Swiss grid. Inverted slab marks active selection.
// Confirms before clearing a non-empty cart (order-service rejects mixed
// currencies).
export function CurrencySwitcher(): JSX.Element {
  const currency = useCurrencyStore((s) => s.currency);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);
  const cartItems = useCartStore((s) => s.items);
  const cartCurrency = useCartStore((s) => s.currency);
  const { clear } = useCartMutations();
  const [pendingTarget, setPendingTarget] = useState<Currency | null>(null);

  const handleSelect = (next: Currency): void => {
    if (next === currency) return;
    const cartHasOtherCurrency =
      cartItems.length > 0 && cartCurrency !== null && cartCurrency !== next;
    if (cartHasOtherCurrency) {
      setPendingTarget(next);
      return;
    }
    setCurrency(next);
    window.location.reload();
  };

  const confirmSwitch = async (): Promise<void> => {
    if (!pendingTarget) return;
    await clear();
    setCurrency(pendingTarget);
    setPendingTarget(null);
    window.location.reload();
  };

  return (
    <>
      <div
        role="group"
        aria-label="Currency"
        className="inline-flex h-9 items-stretch divide-x divide-border rounded-md border border-border bg-bg text-xs"
      >
        {SUPPORTED_CURRENCIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => handleSelect(c)}
            aria-pressed={c === currency}
            className={cn(
              'px-3 font-semibold uppercase tracking-wider transition-colors first:rounded-l-md last:rounded-r-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
              c === currency
                ? 'bg-fg text-bg'
                : 'text-muted-fg hover:bg-muted hover:text-fg',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <Dialog
        open={pendingTarget !== null}
        onClose={() => setPendingTarget(null)}
        title="Switch currency?"
        description={`Your cart is priced in ${cartCurrency ?? '—'}. Switching to ${pendingTarget ?? '—'} will clear it.`}
      >
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPendingTarget(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void confirmSwitch()}>
            Clear cart &amp; switch
          </Button>
        </div>
      </Dialog>
    </>
  );
}
