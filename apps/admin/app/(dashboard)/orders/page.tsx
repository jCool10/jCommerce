'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import type { OrderStatus } from '@jcool/contracts';
import { DataTable } from '@/components/data-table/data-table';
import { OrderDetailDrawer } from '@/components/order-detail-drawer';
import { StatusBadge, orderStatusLabel } from '@/components/status-badge';
import { ordersApi, type OrderView } from '@/lib/api/orders';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { setOrderStatus } from '@/lib/store/slices/ui-filters.slice';
import { openOrderDrawer } from '@/lib/store/slices/modals.slice';
import { formatMoney, cn } from '@/lib/utils';

const STATUSES: ReadonlyArray<OrderStatus> = [
  'PENDING',
  'INVENTORY_RESERVED',
  'PAYMENT_PENDING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

// Order service ListOrdersQuerySchema does NOT accept a status filter — chips
// filter client-side over the most recent page. Backend-side status filter is
// a follow-up.
const PAGE_LIMIT = 100;

export default function OrdersPage(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const statusFilter = useAppSelector((s) => s.uiFilters.orders.status);

  const orders = useQuery({
    queryKey: ['orders', { limit: PAGE_LIMIT }],
    queryFn: () => ordersApi.list({ limit: PAGE_LIMIT }),
    refetchInterval: 10_000,
  });

  const filtered = useMemo(() => {
    const items = orders.data?.items ?? [];
    return statusFilter ? items.filter((o) => o.status === statusFilter) : items;
  }, [orders.data, statusFilter]);

  const counts = useMemo(() => {
    const items = orders.data?.items ?? [];
    const out: Record<string, number> = { all: items.length };
    for (const s of STATUSES) out[s] = 0;
    for (const o of items) out[o.status] = (out[o.status] ?? 0) + 1;
    return out;
  }, [orders.data]);

  const columns = useMemo<ColumnDef<OrderView>[]>(
    () => [
      {
        id: 'id',
        header: 'Order',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.id.slice(0, 8)}…
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'items',
        header: 'Items',
        cell: ({ row }) => <span className="tabular-nums">{row.original.items.length}</span>,
      },
      {
        id: 'total',
        header: 'Total',
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatMoney(row.original.totalAmount, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {new Date(row.original.createdAt).toLocaleString()}
          </span>
        ),
      },
    ],
    [],
  );

  const total = orders.data?.items.length ?? 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Showing recent {total} orders. Auto-refresh every 10s. Status filter is client-side.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-2 shadow-soft">
        <button
          type="button"
          onClick={() => dispatch(setOrderStatus(null))}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-ring',
            statusFilter === null
              ? 'bg-foreground text-background'
              : 'text-foreground/70 hover:bg-muted',
          )}
        >
          All <span className="tabular-nums opacity-70">{counts.all ?? 0}</span>
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => dispatch(setOrderStatus(s))}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-ring',
              statusFilter === s
                ? 'bg-foreground text-background'
                : 'text-foreground/70 hover:bg-muted',
            )}
          >
            {orderStatusLabel(s)}{' '}
            <span className="tabular-nums opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={orders.isPending}
        emptyTitle="No orders"
        emptyMessage={
          statusFilter
            ? `No orders with status “${orderStatusLabel(statusFilter)}” in the recent ${total}.`
            : 'No orders yet.'
        }
        onRowClick={(o) => dispatch(openOrderDrawer({ orderId: o.id }))}
      />

      <OrderDetailDrawer />
    </div>
  );
}
