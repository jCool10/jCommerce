import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/20 bg-primary/10 text-primary',
        secondary: 'border-border bg-muted text-foreground',
        outline: 'border-border bg-transparent text-foreground',
        success: 'border-success/20 bg-success/10 text-success',
        warning: 'border-warning/30 bg-warning/15 text-warning',
        info: 'border-info/20 bg-info/10 text-info',
        destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
        solid: 'border-transparent bg-foreground text-background',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
