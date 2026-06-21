import Link from 'next/link';
import { cn } from '@/lib/cn';

interface BrandMarkProps {
  className?: string;
  /** Hide wordmark — useful for very tight chrome. */
  iconOnly?: boolean;
}

// Swiss Modernism mark: solid square slab + wordmark in Rubik, tight tracking.
// Single fg color, no gradient. Inverts cleanly in dark mode.
export function BrandMark({ className, iconOnly = false }: BrandMarkProps): JSX.Element {
  return (
    <Link
      href="/"
      className={cn(
        'group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm',
        className,
      )}
      aria-label="jCool home"
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-sm bg-fg font-display text-bg text-base font-bold leading-none tracking-tighter transition-transform group-hover:-rotate-3"
        aria-hidden="true"
      >
        j
      </span>
      {iconOnly ? null : (
        <span className="font-display text-base font-semibold tracking-tighter text-fg">
          jCool<span className="text-accent-500">.</span>
        </span>
      )}
    </Link>
  );
}
