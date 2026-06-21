import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  trend?: { direction: 'up' | 'down' | 'flat'; value: string };
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  loading,
}: KpiCardProps): React.JSX.Element {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-elevated">
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/5 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <div className="grid h-8 w-8 place-items-center rounded-md bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-muted" aria-hidden="true" />
        ) : (
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        )}
        {trend && !loading && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
              trend.direction === 'up' && 'text-success',
              trend.direction === 'down' && 'text-destructive',
              trend.direction === 'flat' && 'text-muted-foreground',
            )}
          >
            {trend.direction === 'up' && <ArrowUpRight className="h-3 w-3" />}
            {trend.direction === 'down' && <ArrowDownRight className="h-3 w-3" />}
            {trend.value}
          </span>
        )}
      </div>

      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
