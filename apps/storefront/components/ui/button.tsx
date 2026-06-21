import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'destructive' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

// Swiss Modernism: one accent (orange) reserved for high-intent commerce
// commits — Add to cart, Pay. `brand` is the neutral inverted slab — used for
// most other primary actions (Browse, Sign in, Submit). `secondary` is a
// bordered neutral. Sharp radius, minimal shadow, no gradients.
const VARIANT: Record<Variant, string> = {
  primary:
    'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700',
  brand:
    'bg-fg text-bg hover:bg-brand-800 dark:hover:bg-brand-200 active:bg-brand-700 dark:active:bg-brand-300',
  secondary:
    'border border-border bg-bg text-fg hover:bg-muted active:bg-muted/80',
  outline:
    'border border-fg/80 bg-transparent text-fg hover:bg-fg hover:text-bg active:bg-brand-800 active:text-bg dark:active:bg-brand-200 dark:active:text-bg',
  ghost: 'text-fg hover:bg-muted active:bg-muted/80',
  destructive:
    'bg-danger-600 text-white hover:bg-danger-500 active:bg-danger-600/90',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  xl: 'h-12 px-6 text-base gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    type = 'button',
    leadingIcon,
    trailingIcon,
    loading = false,
    fullWidth = false,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium tracking-tight transition-colors duration-200 ease-swiss',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        fullWidth && 'w-full',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
});

function Spinner(): JSX.Element {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
