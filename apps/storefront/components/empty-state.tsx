import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
  cta?: {
    href: string;
    label: string;
  };
  /** Optional extra content (e.g. secondary link) rendered below the CTA. */
  children?: ReactNode;
}

// Editorial empty state — bordered card, mono icon tile, primary CTA.
export function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
  children,
}: EmptyStateProps): JSX.Element {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-md border border-dashed border-border bg-bg p-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-sm border border-border text-muted-fg">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <div className="space-y-2">
        <p className="font-display text-lg font-semibold tracking-tight text-fg">{title}</p>
        <p className="text-sm text-muted-fg">{body}</p>
      </div>
      {cta ? (
        <Link
          href={{ pathname: cta.href }}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-fg px-5 text-sm font-semibold text-bg transition-colors hover:bg-brand-800 dark:hover:bg-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {cta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
      {children}
    </div>
  );
}
