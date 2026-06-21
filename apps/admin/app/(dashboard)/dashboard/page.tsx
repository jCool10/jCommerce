'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, DollarSign, Package, ShoppingCart, TriangleAlert } from 'lucide-react';
import { KpiCard } from '@/components/kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ordersApi } from '@/lib/api/orders';
import { productsApi } from '@/lib/api/products';
import { formatMoney } from '@/lib/utils';
import {
  PeriodFilter,
  periodCutoffMs,
  type DashboardPeriod,
} from '@/components/period-filter';
import { RevenueTrendChart } from '@/components/revenue-trend-chart';
import { OrdersByStatusChart } from '@/components/orders-by-status-chart';

// Aggregation endpoints are not yet exposed by the backend. MVP derives KPIs
// + chart series client-side from the first page of recent data, scoped to the
// selected period. Backend aggregation is tracked as a follow-up.
const RECENT_LIMIT = 100;

export default function DashboardPage(): React.JSX.Element {
  const [period, setPeriod] = useState<DashboardPeriod>('7d');

  const orders = useQuery({
    queryKey: ['dashboard', 'orders'],
    queryFn: () => ordersApi.list({ limit: RECENT_LIMIT }),
  });

  const products = useQuery({
    queryKey: ['dashboard', 'products'],
    queryFn: () => productsApi.list({ limit: RECENT_LIMIT }),
  });

  const allOrders = orders.data?.items ?? [];
  const periodCutoff = periodCutoffMs(period);
  const periodOrders = useMemo(
    () => allOrders.filter((o) => new Date(o.createdAt).getTime() >= periodCutoff),
    [allOrders, periodCutoff],
  );

  const revenuePeriodUsd = periodOrders
    .filter((o) => o.currency === 'USD' && o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const productItems = products.data?.items ?? [];
  const lowStockSkus = productItems.flatMap((p) =>
    p.skus.filter((s) => s.stock <= 5).map((s) => ({ ...s, productName: p.name, productId: p.id })),
  );

  const recentOrders = allOrders.slice(0, 6);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Showing the most recent {RECENT_LIMIT} orders, scoped to the selected period.
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </header>

      <section
        aria-label="Key performance indicators"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <KpiCard
          label={periodLabel(period, 'Orders')}
          value={String(periodOrders.length)}
          hint={
            orders.isPending
              ? 'Loading…'
              : allOrders.length === RECENT_LIMIT
                ? `capped at ${RECENT_LIMIT} recent — may undercount long windows`
                : `${allOrders.length} recent in window`
          }
          icon={ShoppingCart}
          loading={orders.isPending}
        />
        <KpiCard
          label={periodLabel(period, 'Revenue')}
          value={formatMoney(revenuePeriodUsd, 'USD')}
          hint="USD only · excludes cancelled"
          icon={DollarSign}
          loading={orders.isPending}
        />
        <KpiCard
          label="Low-stock SKUs"
          value={String(lowStockSkus.length)}
          hint="stock ≤ 5 across recent products"
          icon={Package}
          loading={products.isPending}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue trend</CardTitle>
            <CardDescription>USD revenue per day · excludes cancelled.</CardDescription>
          </CardHeader>
          <CardContent>
            {orders.isPending ? (
              <div className="h-40 animate-pulse rounded bg-muted" />
            ) : (
              <RevenueTrendChart orders={periodOrders} currency="USD" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
            <CardDescription>Distribution across saga states.</CardDescription>
          </CardHeader>
          <CardContent>
            {orders.isPending ? (
              <div className="h-40 animate-pulse rounded bg-muted" />
            ) : (
              <OrdersByStatusChart orders={periodOrders} />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Recent orders</CardTitle>
              <CardDescription>Last six orders, newest first.</CardDescription>
            </div>
            <Link
              href="/orders"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {orders.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                No orders yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/orders/${o.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-md"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          {o.id.slice(0, 8)}
                        </span>
                        <StatusBadge status={o.status} />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                          {o.items.length} item{o.items.length === 1 ? '' : 's'}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatMoney(o.totalAmount, o.currency)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Low stock</CardTitle>
              {lowStockSkus.length > 0 && (
                <span className="inline-flex h-5 items-center gap-1 rounded-full bg-warning/15 px-2 text-xs font-medium text-warning">
                  <TriangleAlert className="h-3 w-3" /> {lowStockSkus.length}
                </span>
              )}
            </div>
            <CardDescription>SKUs with stock ≤ 5.</CardDescription>
          </CardHeader>
          <CardContent>
            {products.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : lowStockSkus.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                All recent SKUs are healthy.
              </p>
            ) : (
              <ul className="space-y-2">
                {lowStockSkus.slice(0, 6).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      href={`/products/${s.productId}`}
                      className="min-w-0 truncate hover:underline"
                    >
                      <span className="font-medium">{s.productName}</span>{' '}
                      <span className="font-mono text-xs text-muted-foreground">
                        · {s.sku}
                      </span>
                    </Link>
                    <span className="shrink-0 rounded-md bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning tabular-nums">
                      {s.stock} left
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function periodLabel(period: DashboardPeriod, prefix: string): string {
  switch (period) {
    case 'today':
      return `${prefix} today`;
    case '7d':
      return `${prefix} (7d)`;
    case '30d':
      return `${prefix} (30d)`;
    case 'all':
    default:
      return `${prefix} (recent)`;
  }
}
