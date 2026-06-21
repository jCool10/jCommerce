import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { auth } from '@/lib/auth-config';
import { orderApi } from '@/lib/api/orders';
import { ApiError } from '@/lib/api-client';
import { formatAmount } from '@/lib/money';
import { parseCurrencyOrDefault } from '@/lib/currency';
import { OrderStatusBadge } from '@/components/ui/badge';

interface OrderDetailProps {
  params: { id: string };
  searchParams: { paid?: string };
}

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({
  params,
  searchParams,
}: OrderDetailProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.accessToken) redirect(`/login?callbackUrl=/orders/${params.id}`);

  let order;
  try {
    order = await orderApi.getById(params.id, {
      server: true,
      accessToken: session.accessToken,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const currency = parseCurrencyOrDefault(order.currency);

  return (
    <div className="pb-24">
      <div className="container py-10">
        <div className="mx-auto max-w-3xl space-y-8">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-fg"
          >
            <Link href="/orders" className="transition-colors hover:text-fg">
              Orders
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-fg">#{order.id.slice(0, 8)}</span>
          </nav>

          {searchParams.paid ? (
            <div className="flex items-start gap-3 rounded-md border border-success-500/30 bg-success-100/50 px-4 py-3 text-sm text-success-600 dark:bg-success-500/10">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Payment received</p>
                <p className="text-xs text-success-600/80">
                  We&apos;ll send a confirmation email shortly. Your order is being prepared for shipping.
                </p>
              </div>
            </div>
          ) : null}

          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
                Order #{order.id.slice(0, 8)}
              </p>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-tighter text-fg md:text-5xl">
                {new Date(order.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </h1>
              <p className="mt-1 text-xs text-muted-fg">
                {new Date(order.createdAt).toLocaleTimeString()}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
          </header>

          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
              Items
            </h2>
            <ul className="divide-y divide-border border-y border-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-4">
                  <div className="space-y-1">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
                      SKU {item.skuId.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-fg tabular-nums">
                      Qty <span className="text-fg">{item.quantity}</span> ·{' '}
                      {formatAmount(item.unitAmount, currency)} each
                    </p>
                  </div>
                  <span className="font-display text-base font-semibold tracking-tight text-fg tabular-nums">
                    {formatAmount(item.unitAmount * item.quantity, currency)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
                Total
              </span>
              <span className="font-display text-3xl font-semibold tracking-tight text-fg tabular-nums">
                {formatAmount(order.totalAmount, currency)}
              </span>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
              Shipping address
            </h2>
            <address className="rounded-md border border-border bg-bg-elevated p-5 text-sm not-italic text-fg">
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
              className="rounded-md border border-danger-500/30 bg-danger-100/40 px-4 py-3 text-xs text-danger-600"
            >
              Cancelled — reason: <strong>{order.cancelReason}</strong>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
