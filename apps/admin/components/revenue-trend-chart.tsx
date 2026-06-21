'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OrderView } from '@/lib/api/orders';
import { formatMoney } from '@/lib/utils';

interface RevenueTrendChartProps {
  orders: OrderView[];
  /** Currency to chart. Orders in other currencies are filtered out. */
  currency: 'USD' | 'VND';
}

// Daily revenue line — sums confirmed-and-beyond orders into per-day buckets.
// Cancelled orders are excluded to keep the picture honest.
export function RevenueTrendChart({
  orders,
  currency,
}: RevenueTrendChartProps): React.JSX.Element {
  const data = useMemo(() => bucketByDay(orders, currency), [orders, currency]);

  if (data.length === 0) {
    return (
      <div className="grid h-40 place-items-center rounded-md border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
        No revenue data for the selected period.
      </div>
    );
  }

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenue-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="dayLabel"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            width={64}
            tickFormatter={(v) => formatMoney(Number(v), currency)}
          />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--border))' }}
            contentStyle={{
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value) => [formatMoney(Number(value), currency), 'Revenue']}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#revenue-gradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DayBucket {
  day: string;
  dayLabel: string;
  revenue: number;
}

function bucketByDay(orders: OrderView[], currency: string): DayBucket[] {
  const buckets = new Map<string, number>();
  for (const order of orders) {
    if (order.currency !== currency) continue;
    if (order.status === 'CANCELLED') continue;
    const d = new Date(order.createdAt);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    buckets.set(key, (buckets.get(key) ?? 0) + order.totalAmount);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, revenue]) => ({
      day,
      dayLabel: day.slice(5),
      revenue,
    }));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
