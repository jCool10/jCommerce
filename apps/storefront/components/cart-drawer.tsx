'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCartStore } from '@/lib/store/cart-store';
import { useCartMutations } from '@/lib/hooks/use-cart-mutations';
import { formatAmount } from '@/lib/money';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps): JSX.Element {
  const items = useCartStore((s) => s.items);
  const subtotalAmount = useCartStore((s) => s.subtotalAmount);
  const currency = useCartStore((s) => s.currency);
  const status = useCartStore((s) => s.status);
  const { updateQuantity, remove } = useCartMutations();
  const [, startTransition] = useTransition();
  const [busySkuId, setBusySkuId] = useState<string | null>(null);

  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Your cart"
      description={itemCount > 0 ? `${itemCount} item${itemCount === 1 ? '' : 's'}` : undefined}
      side="right"
    >
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-bg text-muted-fg">
            <ShoppingBag className="h-6 w-6" />
          </span>
          <p className="font-display text-lg font-semibold tracking-tight text-fg">
            {status === 'loading' ? 'Loading cart…' : 'Your cart is empty'}
          </p>
          <p className="max-w-xs text-sm text-muted-fg">
            Browse the catalog and add a few favourites to see them here.
          </p>
          <Link
            href="/products"
            onClick={onClose}
            className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-fg px-5 text-sm font-medium text-bg transition-colors hover:bg-brand-800 dark:hover:bg-brand-200"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <ul className="flex-1 divide-y divide-border">
            {items.map((item) => {
              const isBusy = busySkuId === item.skuId;
              const dec = (): void => {
                setBusySkuId(item.skuId);
                startTransition(() => {
                  void updateQuantity(item.skuId, Math.max(0, item.quantity - 1)).finally(() =>
                    setBusySkuId(null),
                  );
                });
              };
              const inc = (): void => {
                setBusySkuId(item.skuId);
                startTransition(() => {
                  void updateQuantity(item.skuId, item.quantity + 1).finally(() =>
                    setBusySkuId(null),
                  );
                });
              };
              return (
                <li key={item.skuId} className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">{item.productName}</p>
                    <p className="text-xs text-muted-fg tabular-nums">
                      {formatAmount(item.unitAmount, item.currency)} · each
                    </p>
                  </div>
                  <div className="flex items-center divide-x divide-border rounded-md border border-border">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.productName}`}
                      onClick={dec}
                      disabled={isBusy}
                      className="flex h-8 w-8 items-center justify-center text-muted-fg transition-colors hover:bg-muted hover:text-fg disabled:opacity-50"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-9 px-1 text-center text-xs font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase ${item.productName}`}
                      onClick={inc}
                      disabled={isBusy}
                      className="flex h-8 w-8 items-center justify-center text-muted-fg transition-colors hover:bg-muted hover:text-fg disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${item.productName}`}
                    onClick={() => {
                      setBusySkuId(item.skuId);
                      startTransition(() => {
                        void remove(item.skuId).finally(() => setBusySkuId(null));
                      });
                    }}
                    disabled={isBusy}
                    className="rounded-sm p-1 text-muted-fg transition-colors hover:text-danger-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">
                Subtotal
              </span>
              <span className="font-display text-2xl font-semibold tracking-tight text-fg tabular-nums">
                {currency ? formatAmount(subtotalAmount, currency) : '—'}
              </span>
            </div>
            <p className="text-xs text-muted-fg">
              Shipping &amp; taxes calculated at checkout.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={onClose}>
                Keep shopping
              </Button>
              <Link
                href="/checkout"
                onClick={onClose}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-accent-500 text-sm font-semibold text-white transition-colors hover:bg-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Checkout
              </Link>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
