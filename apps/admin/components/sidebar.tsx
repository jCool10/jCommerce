'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Catalog',
    items: [{ href: '/products', label: 'Products', icon: Package }],
  },
  {
    label: 'Operations',
    items: [{ href: '/orders', label: 'Orders', icon: ShoppingCart }],
  },
  {
    label: 'People',
    items: [{ href: '/users', label: 'Users', icon: Users }],
  },
  {
    label: 'Configuration',
    items: [{ href: '/settings', label: 'Settings', icon: Settings }],
  },
];

const COLLAPSE_KEY = 'jcool-admin-sidebar-collapsed';

export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  function toggle(): void {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
  }

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex lg:flex-col',
        collapsed ? 'w-[68px]' : 'w-[244px]',
      )}
      data-collapsed={collapsed}
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <span className="font-mono text-sm font-bold">j</span>
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">jCool</span>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Admin</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                      collapsed && 'justify-center',
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-primary"
                      />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        {!collapsed && session?.user && (
          <div className="mb-2 rounded-md px-2 py-1.5">
            <p className="truncate text-sm font-medium">{session.user.name || session.user.email}</p>
            <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
          </div>
        )}
        <div className={cn('flex items-center gap-1', collapsed ? 'flex-col' : 'justify-between')}>
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-2', collapsed && 'w-full justify-center px-0')}
            onClick={() => signOut({ callbackUrl: '/login' })}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sign out</span>}
          </Button>
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggle}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <ChevronsLeft className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
