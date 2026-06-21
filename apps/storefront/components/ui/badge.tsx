import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}

// Swiss Modernism: flat tonal chips, sharp small radius, uppercase tracking.
// `neutral` = outline default. `brand` = solid inverted slab. `accent` = orange.
const TONE: Record<Tone, string> = {
  neutral: 'border-border bg-bg-elevated text-muted-fg',
  brand: 'border-transparent bg-fg text-bg',
  accent: 'border-transparent bg-accent-500 text-white',
  success: 'border-transparent bg-success-100 text-success-600 dark:bg-success-500/15 dark:text-success-500',
  warning: 'border-transparent bg-warning-100 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  danger: 'border-transparent bg-danger-100 text-danger-600 dark:bg-danger-500/15 dark:text-danger-500',
};

export function Badge({ tone = 'neutral', className, children }: BadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  PENDING: 'neutral',
  INVENTORY_RESERVED: 'brand',
  PAYMENT_PENDING: 'warning',
  CONFIRMED: 'success',
  SHIPPED: 'brand',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

export function OrderStatusBadge({ status }: { status: string }): JSX.Element {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Badge>;
}
