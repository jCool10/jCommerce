'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { OrderDetailView } from './order-detail-view';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { closeOrderDrawer } from '@/lib/store/slices/modals.slice';

interface OrderDetailDrawerProps {
  onClose?: () => void;
}

// Quick-preview drawer — delegates layout + actions to `OrderDetailView`.
// Full-page route uses the same view for parity.
export function OrderDetailDrawer({
  onClose,
}: OrderDetailDrawerProps = {}): React.JSX.Element | null {
  const dispatch = useAppDispatch();
  const { open, orderId } = useAppSelector((s) => s.modals.orderDetailDrawer);

  function handleOpenChange(o: boolean): void {
    if (!o) {
      dispatch(closeOrderDrawer());
      onClose?.();
    }
  }

  if (!orderId) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base">Order detail</SheetTitle>
              <SheetDescription className="font-mono text-xs">{orderId}</SheetDescription>
            </div>
            <Link
              href={`/orders/${orderId}`}
              onClick={() => handleOpenChange(false)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Full view <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Pause polling when sheet is hidden — orderId may persist in
              Redux briefly after close for re-open animation. */}
          <OrderDetailView
            orderId={orderId}
            variant="drawer"
            pollMs={open ? 10_000 : false}
          />
        </div>

        <SheetFooter className="m-0 border-t border-border bg-muted/20 px-6 py-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
