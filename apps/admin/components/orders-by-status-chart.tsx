'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OrderStatus } from '@jcool/contracts';
import type { OrderView } from '@/lib/api/orders';

interface OrdersByStatusChartProps {
  orders: OrderView[];
}

const STATUS_ORDER: OrderStatus[] = [
  'PENDING',
  'INVENTORY_RESERVED',
  'PAYMENT_PENDING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: 'hsl(var(--muted-foreground))',
  INVENTORY_RESERVED: 'hsl(214 95% 56%)',
  PAYMENT_PENDING: 'hsl(38 92% 50%)',
  CONFIRMED: 'hsl(152 60% 38%)',
  SHIPPED: 'hsl(214 95% 56%)',
  DELIVERED: 'hsl(152 60% 38%)',
  CANCELLED: 'hsl(0 74% 51%)',
};

// Categorical bar chart — order counts per saga state.
export function OrdersByStatusChart({
  orders,
}: OrdersByStatusChartProps): React.JSX.Element {
  const data = useMemo(() => {
    const counts = new Map<OrderStatus, number>();
    for (const o of orders) {
      counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    }
    return STATUS_ORDER.map((status) => ({
      status,
      label: formatStatus(status),
      count: counts.get(status) ?? 0,
      fill: STATUS_COLOR[status],
    })).filter((row) => row.count > 0);
  }, [orders]);

  if (data.length === 0) {
    return (
      <div className="grid h-40 place-items-center rounded-md border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
        No orders for the selected period.
      </div>
    );
  }

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            interval={0}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
            contentStyle={{
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((row) => (
              <Cell key={row.status} fill={row.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatStatus(status: OrderStatus): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
