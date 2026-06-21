import type { OrderStatus } from '@jcool/contracts';
import { Badge, type BadgeProps } from '@/components/ui/badge';

type Variant = NonNullable<BadgeProps['variant']>;

const STATUS_VARIANT: Record<OrderStatus, Variant> = {
  PENDING: 'secondary',
  INVENTORY_RESERVED: 'info',
  PAYMENT_PENDING: 'warning',
  CONFIRMED: 'info',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  INVENTORY_RESERVED: 'Inventory reserved',
  PAYMENT_PENDING: 'Payment pending',
  CONFIRMED: 'Confirmed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export function StatusBadge({ status }: { status: OrderStatus }): React.JSX.Element {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL[status];
}
