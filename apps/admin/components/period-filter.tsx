'use client';

import { cn } from '@/lib/utils';

export type DashboardPeriod = 'today' | '7d' | '30d' | 'all';

interface PeriodFilterProps {
  value: DashboardPeriod;
  onChange: (next: DashboardPeriod) => void;
}

const OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All recent' },
];

// Segmented control — pure UI, parent owns state.
export function PeriodFilter({ value, onChange }: PeriodFilterProps): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label="Dashboard period"
      className="inline-flex items-center rounded-md border border-border bg-muted/30 p-0.5 text-xs"
    >
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-7 items-center rounded-sm px-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function periodCutoffMs(period: DashboardPeriod): number {
  const now = Date.now();
  switch (period) {
    case 'today': {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return now - 30 * 24 * 60 * 60 * 1000;
    case 'all':
    default:
      return 0;
  }
}
