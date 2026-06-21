'use client';

import { ArrowRight, Ban, Loader2, RotateCcw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { OrderStatus } from '@jcool/contracts';
import { Button } from '@/components/ui/button';
import { ordersApi, type OrderView } from '@/lib/api/orders';

interface OrderFulfillmentActionsProps {
  order: OrderView;
}

const NEXT_STATUS: Partial<Record<OrderStatus, 'SHIPPED' | 'DELIVERED'>> = {
  CONFIRMED: 'SHIPPED',
  SHIPPED: 'DELIVERED',
};

// Action bar shown at the bottom of any order-detail surface (drawer + full page).
// Mark-next maps the saga's forward transitions; refund/cancel are surfaced as
// disabled affordances until backend endpoints land.
export function OrderFulfillmentActions({
  order,
}: OrderFulfillmentActionsProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const next = NEXT_STATUS[order.status];

  const advance = useMutation({
    mutationFn: async (target: 'SHIPPED' | 'DELIVERED') => ordersApi.updateStatus(order.id, target),
    onMutate: async (target) => {
      await queryClient.cancelQueries({ queryKey: ['order', order.id] });
      const prev = queryClient.getQueryData<OrderView>(['order', order.id]);
      if (prev) {
        queryClient.setQueryData<OrderView>(['order', order.id], { ...prev, status: target });
      }
      return { prev };
    },
    onError: (_err, _target, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['order', order.id], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  return (
    <section className="space-y-3 border-t border-border pt-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Fulfillment
      </h3>
      <div className="flex flex-wrap gap-2">
        {next ? (
          <Button
            disabled={advance.isPending}
            onClick={() => advance.mutate(next)}
            className="gap-1.5"
          >
            {advance.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating…
              </>
            ) : (
              <>
                Mark {next.toLowerCase()}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        ) : null}

        <Button
          variant="outline"
          disabled
          className="gap-1.5"
          title="Refund endpoint not yet wired on order-service"
        >
          <RotateCcw className="h-4 w-4" />
          Refund
        </Button>
        <Button
          variant="outline"
          disabled
          className="gap-1.5"
          title="Cancel endpoint not yet wired on order-service"
        >
          <Ban className="h-4 w-4" />
          Cancel order
        </Button>
      </div>
      {advance.isError ? (
        <p className="text-xs text-destructive">
          {advance.error instanceof Error ? advance.error.message : 'Status update failed.'}
        </p>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        Refund &amp; cancel surface as disabled until the order-service exposes the matching endpoints.
      </p>
    </section>
  );
}
