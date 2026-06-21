'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { LogOut, Menu, Package, Search, ShoppingBag, UserRound } from 'lucide-react';
import { useCartStore } from '@/lib/store/cart-store';
import { useCartSync } from '@/lib/hooks/use-cart-sync';
import { useCartMergeOnLogin } from '@/lib/hooks/use-cart-merge-on-login';
import { cn } from '@/lib/cn';
import { BrandMark } from './brand-mark';
import { CartDrawer } from './cart-drawer';
import { CurrencySwitcher } from './currency-switcher';
import { MobileNavDrawer } from './mobile-nav-drawer';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { href: '/products', label: 'Shop' },
  { href: '/search', label: 'Search', icon: Search },
] as const;

export function SiteHeader(): JSX.Element {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const itemCount = useCartStore((s) => s.items.reduce((acc, item) => acc + item.quantity, 0));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useCartSync();
  useCartMergeOnLogin();

  const isActive = (href: string): boolean =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <div className="container flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-3 md:gap-10">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg text-fg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <BrandMark />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map(({ href, label }) => (
              <NavLink key={href} href={href} active={isActive(href)}>
                {label}
              </NavLink>
            ))}
            {status === 'authenticated' ? (
              <NavLink href="/orders" active={isActive('/orders')}>
                Orders
              </NavLink>
            ) : null}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <CurrencySwitcher />
          </div>
          <ThemeToggle />

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={`Open cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg text-fg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            <ShoppingBag className="h-4 w-4" />
            {itemCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-sm bg-accent-500 px-1 text-[10px] font-bold leading-none text-white tabular-nums">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            ) : null}
          </button>

          {status === 'authenticated' ? (
            <>
              <Link
                href="/account"
                className="hidden h-9 items-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-medium text-fg transition-colors hover:bg-muted sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
                aria-label="Account"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-fg text-[10px] font-bold text-bg tabular-nums">
                  {(session?.user?.name ?? session?.user?.email ?? '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-32 truncate">
                  {session?.user?.name ?? session?.user?.email}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: '/' })}
                aria-label="Sign out"
                className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-fg transition-colors hover:bg-muted hover:text-fg sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg px-3.5 text-xs font-semibold uppercase tracking-wider text-fg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            >
              <UserRound className="h-3.5 w-3.5" />
              Sign in
            </Link>
          )}
        </div>
      </div>
      <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <MobileNavDrawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        authenticated={status === 'authenticated'}
        userLabel={session?.user?.name ?? session?.user?.email ?? null}
      />
    </header>
  );
}

interface NavLinkProps {
  href: string;
  active: boolean;
  children: React.ReactNode;
}

// Underline-on-active marker — Swiss Modernism stays away from pill chips.
function NavLink({ href, active, children }: NavLinkProps): JSX.Element {
  return (
    <Link
      href={{ pathname: href }}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative inline-flex h-9 items-center px-2.5 text-sm font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded-sm',
        'after:absolute after:inset-x-2.5 after:bottom-0 after:h-[2px] after:origin-left after:scale-x-0 after:bg-fg after:transition-transform after:duration-200 after:ease-swiss',
        active
          ? 'text-fg after:scale-x-100'
          : 'text-muted-fg hover:text-fg hover:after:scale-x-100',
      )}
    >
      {children}
    </Link>
  );
}
