import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', leadingIcon, trailingSlot, ...rest },
  ref,
) {
  const hasLeading = Boolean(leadingIcon);
  const hasTrailing = Boolean(trailingSlot);
  return (
    <div className="relative w-full">
      {hasLeading ? (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-fg">
          {leadingIcon}
        </span>
      ) : null}
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-11 w-full rounded-md border border-border bg-bg text-sm text-fg transition-colors',
          'placeholder:text-muted-fg',
          'focus-visible:outline-none focus-visible:border-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-danger-500 aria-[invalid=true]:focus-visible:ring-danger-500',
          hasLeading ? 'pl-10' : 'pl-3.5',
          hasTrailing ? 'pr-10' : 'pr-3.5',
          className,
        )}
        {...rest}
      />
      {hasTrailing ? (
        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-fg">
          {trailingSlot}
        </span>
      ) : null}
    </div>
  );
});
