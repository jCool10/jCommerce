'use client';

import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ordersApi, type OrderView } from '@/lib/api/orders';
import { formatMoney } from '@/lib/utils';
import { StatusBadge } from './status-badge';
import { OrderFulfillmentActions } from './order-fulfillment-actions';

interface OrderDetailViewProps {
  orderId: string;
  /** Drawer mode uses tighter spacing + omits the header (drawer has its own). */
  variant?: 'page' | 'drawer';
  /** Set in drawer to pause polling when closed. */
  pollMs?: number | false;
}

const DEFAULT_POLL_MS = 10_000;

// Shared order-detail block used by full-page route and drawer wrapper.
// Owns: data fetching, layout (summary + items + shipping + actions).
export function OrderDetailView({
  orderId,
  variant = 'page',
  pollMs = DEFAULT_POLL_MS,
}: OrderDetailViewProps): React.JSX.Element {
  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(orderId),
    refetchInterval: pollMs === false ? false : pollMs,
  });

  if (orderQuery.isPending) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading order…
      </div>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Failed to load order. Try refreshing.
      </div>
    );
  }

  const order: OrderView = orderQuery.data;
  const isPage = variant === 'page';

  return (
    <div className={isPage ? 'space-y-6' : 'space-y-5'}>
      {isPage ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Order
            </p>
            <h2 className="font-mono text-base font-semibold tracking-tight">
              {orderId}
            </h2>
          </div>
          <StatusBadge status={order.status} />
        </header>
      ) : null}

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Summary
        </h3>
        <dl className={`grid gap-3 rounded-md border border-border bg-muted/20 p-4 text-sm ${isPage ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>
          <Field label="Total" value={formatMoney(order.totalAmount, order.currency)} />
          <Field label="Items" value={String(order.items.length)} />
          <Field label="Created" value={new Date(order.createdAt).toLocaleString()} />
          <Field label="Updated" value={new Date(order.updatedAt).toLocaleString()} />
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Line items
        </h3>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">SKU</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Unit price</th>
                <th className="px-3 py-2 text-right font-medium">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id} className="border-t border-border/60">
                  <td className="px-3 py-2 font-mono text-xs">{it.skuId}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{it.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(it.unitAmount, it.currency)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {formatMoney(it.unitAmount * it.quantity, it.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Shipping address
        </h3>
        <address className="rounded-md border border-border bg-muted/20 p-4 text-sm not-italic">
          {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? (
            <>
              <br />
              {order.shippingAddress.line2}
            </>
          ) : null}
          <br />
          {order.shippingAddress.city}
          {order.shippingAddress.region ? `, ${order.shippingAddress.region}` : ''}{' '}
          {order.shippingAddress.postalCode}
          <br />
          {order.shippingAddress.country}
        </address>
      </section>

      {order.cancelReason ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Cancelled — reason: <strong>{order.cancelReason}</strong>
        </div>
      ) : null}

      <OrderFulfillmentActions order={order} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}
