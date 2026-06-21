'use client';

import Link from 'next/link';
import { Package, Search, ShoppingBag, UserRound, LogIn } from 'lucide-react';
import { Dialog } from './ui/dialog';
import { CurrencySwitcher } from './currency-switcher';

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  authenticated: boolean;
  userLabel?: string | null;
}

const NAV_ITEMS = [
  { href: '/products', label: 'Shop all', icon: Package },
  { href: '/search', label: 'Search catalog', icon: Search },
  { href: '/cart', label: 'Your cart', icon: ShoppingBag },
] as const;

export function MobileNavDrawer({
  open,
  onClose,
  authenticated,
  userLabel,
}: MobileNavDrawerProps): JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} side="right" title="Menu">
      <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={{ pathname: href }}
            onClick={onClose}
            className="flex items-center gap-3 rounded-sm px-3 py-3 text-sm font-medium text-fg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="h-4 w-4 text-muted-fg" />
            {label}
          </Link>
        ))}
        {authenticated ? (
          <Link
            href="/orders"
            onClick={onClose}
            className="flex items-center gap-3 rounded-sm px-3 py-3 text-sm font-medium text-fg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Package className="h-4 w-4 text-muted-fg" />
            Your orders
          </Link>
        ) : null}
      </nav>

      <div className="mt-6 space-y-3 border-t border-border pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
          Preferences
        </p>
        <CurrencySwitcher />
      </div>

      <div className="mt-6 border-t border-border pt-5">
        {authenticated ? (
          <Link
            href="/account"
            onClick={onClose}
            className="flex items-center gap-3 rounded-sm bg-muted px-3 py-3 text-sm font-medium text-fg transition-colors hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <UserRound className="h-4 w-4" />
            {userLabel ?? 'Your account'}
          </Link>
        ) : (
          <Link
            href="/login"
            onClick={onClose}
            className="flex items-center gap-3 rounded-sm bg-fg px-3 py-3 text-sm font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-brand-800 dark:hover:bg-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        )}
      </div>
    </Dialog>
  );
}
