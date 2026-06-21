import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight, Package } from 'lucide-react';
import { auth } from '@/lib/auth-config';
import { orderApi } from '@/lib/api/orders';
import { formatAmount } from '@/lib/money';
import { parseCurrencyOrDefault } from '@/lib/currency';
import { OrderStatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orders' };

export default async function OrdersPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.accessToken) redirect('/login?callbackUrl=/orders');

  const page = await orderApi
    .list({ limit: 20 }, { server: true, accessToken: session.accessToken })
    .catch(() => ({ items: [], nextCursor: null }));

  return (
    <div className="pb-24">
      <section className="border-b border-border">
        <div className="container py-12">
          <p className="eyebrow">Orders</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tighter text-fg md:text-6xl">
            Your orders
          </h1>
          <p className="mt-3 text-sm text-muted-fg">
            <span className="font-semibold text-fg tabular-nums">{page.items.length}</span> order
            {page.items.length === 1 ? '' : 's'} on file
          </p>
        </div>
      </section>

      <div className="container py-10">
        {page.items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No orders yet"
            body="Once you complete a checkout, your orders will show up here."
            cta={{ href: '/products', label: 'Browse products' }}
          />
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {page.items.map((order) => (
              <li key={order.id}>
                <Link
                  href={{ pathname: `/orders/${order.id}` }}
                  className="group grid grid-cols-[1fr_auto] items-center gap-4 py-5 sm:grid-cols-[2fr_auto_auto_auto] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded-sm"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
                      #{order.id.slice(0, 8)}
                    </p>
                    <p className="mt-1 text-sm font-medium text-fg">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-fg">
                      {order.items.length} item{order.items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                  <span className="font-display text-base font-semibold tracking-tight text-fg tabular-nums">
                    {formatAmount(order.totalAmount, parseCurrencyOrDefault(order.currency))}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-fg transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fg" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
