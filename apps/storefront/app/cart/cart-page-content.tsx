'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCartStore } from '@/lib/store/cart-store';
import { useCartMutations } from '@/lib/hooks/use-cart-mutations';
import { formatAmount } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';

export function CartPageContent(): JSX.Element {
  const items = useCartStore((s) => s.items);
  const subtotalAmount = useCartStore((s) => s.subtotalAmount);
  const currency = useCartStore((s) => s.currency);
  const status = useCartStore((s) => s.status);
  const { updateQuantity, remove, clear } = useCartMutations();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  if (status === 'loading' && items.length === 0) {
    return (
      <div className="container py-24">
        <p className="text-sm text-muted-fg">Loading cart…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container py-24">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          body="Add a few favourites — we'll save them until you're ready to check out."
          cta={{ href: '/products', label: 'Browse products' }}
        />
      </div>
    );
  }

  return (
    <div className="pb-24">
      <section className="border-b border-border">
        <div className="container py-12">
          <p className="eyebrow">Cart</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tighter text-fg md:text-6xl">
            Review &amp; checkout{' '}
            <span className="text-muted-fg tabular-nums">({items.length})</span>
          </h1>
        </div>
      </section>

      <div className="container grid gap-10 py-12 lg:grid-cols-[1fr_360px] lg:gap-16">
        <section>
          <ul className="divide-y divide-border border-y border-border">
            {items.map((item) => (
              <li
                key={item.skuId}
                className="grid grid-cols-[1fr_auto] items-center gap-4 py-5 sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{item.productName}</p>
                  <p className="mt-1 text-xs text-muted-fg tabular-nums">
                    {formatAmount(item.unitAmount, item.currency)} · each
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-fg">
                    SKU {item.skuId.slice(0, 8)}
                  </p>
                </div>

                <div className="flex items-center divide-x divide-border rounded-md border border-border">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => {
                      setBusy(item.skuId);
                      startTransition(() => {
                        void updateQuantity(item.skuId, Math.max(0, item.quantity - 1)).finally(() =>
                          setBusy(null),
                        );
                      });
                    }}
                    disabled={busy === item.skuId}
                    className="flex h-9 w-9 items-center justify-center text-muted-fg transition-colors hover:bg-muted hover:text-fg disabled:opacity-50"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-10 px-1 text-center text-sm font-semibold tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => {
                      setBusy(item.skuId);
                      startTransition(() => {
                        void updateQuantity(item.skuId, item.quantity + 1).finally(() => setBusy(null));
                      });
                    }}
                    disabled={busy === item.skuId}
                    className="flex h-9 w-9 items-center justify-center text-muted-fg transition-colors hover:bg-muted hover:text-fg disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <span className="w-24 text-right font-display text-base font-semibold tracking-tight text-fg tabular-nums">
                  {formatAmount(item.lineTotal, item.currency)}
                </span>

                <button
                  type="button"
                  aria-label={`Remove ${item.productName}`}
                  onClick={() => {
                    setBusy(item.skuId);
                    startTransition(() => {
                      void remove(item.skuId).finally(() => setBusy(null));
                    });
                  }}
                  className="rounded-sm p-1 text-muted-fg transition-colors hover:text-danger-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end pt-4">
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => void clear()}
            >
              Clear cart
            </Button>
          </div>
        </section>

        <aside className="space-y-5 rounded-md border border-border bg-bg-elevated p-6 lg:sticky lg:top-24 lg:self-start">
          <header className="border-b border-border pb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
              Order summary
            </h2>
          </header>
          <dl className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-fg">Subtotal</dt>
              <dd className="font-medium text-fg tabular-nums">
                {currency ? formatAmount(subtotalAmount, currency) : '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between text-xs text-muted-fg">
              <dt>Shipping</dt>
              <dd>At checkout</dd>
            </div>
            <div className="flex items-baseline justify-between text-xs text-muted-fg">
              <dt>Tax</dt>
              <dd>At checkout</dd>
            </div>
          </dl>
          <div className="border-t border-border pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
                Estimated total
              </span>
              <span className="font-display text-2xl font-semibold tracking-tight text-fg tabular-nums">
                {currency ? formatAmount(subtotalAmount, currency) : '—'}
              </span>
            </div>
          </div>
          <Link
            href="/checkout"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent-500 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated"
          >
            Checkout
            <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
