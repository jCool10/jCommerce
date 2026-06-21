'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Center modal or right-side drawer. */
  side?: 'center' | 'right';
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  side = 'center',
}: DialogProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const containerCls =
    side === 'right'
      ? 'fixed inset-y-0 right-0 flex w-full max-w-md flex-col bg-bg border-l border-border shadow-xl animate-slide-in-right'
      : 'relative z-10 w-full max-w-md rounded-lg border border-border bg-bg p-6 shadow-xl animate-fade-in-up';

  return (
    <div
      className={cn(
        'fixed inset-0 z-50',
        side === 'center' ? 'flex items-center justify-center p-4' : 'flex justify-end',
      )}
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-brand-950/50 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(containerCls, className)}
      >
        {side === 'right' ? (
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              {title ? (
                <h2 className="font-display text-base font-semibold tracking-tight text-fg">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="mt-0.5 text-xs text-muted-fg">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1.5 text-muted-fg transition-colors hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
        ) : (
          <>
            {title ? (
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-base font-semibold tracking-tight text-fg">
                    {title}
                  </h2>
                  {description ? (
                    <p className="mt-1 text-sm text-muted-fg">{description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-md p-1.5 text-muted-fg transition-colors hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </>
        )}
        <div className={side === 'right' ? 'flex-1 overflow-y-auto px-5 py-4' : ''}>
          {children}
        </div>
      </div>
    </div>
  );
}
