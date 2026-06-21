'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

function initials(value: string | null | undefined): string {
  if (!value) return '?';
  const parts = value.split(/[\s@.]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '');
  return letters.join('') || value.slice(0, 2).toUpperCase();
}

export function UserMenu(): React.JSX.Element {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const label = session?.user?.name || session?.user?.email || 'Account';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background pl-1 pr-2.5 text-sm font-medium transition-colors hover:bg-accent focus-ring"
      >
        <span className="grid h-7 w-7 place-items-center rounded-sm bg-primary/10 text-xs font-semibold text-primary">
          {initials(session?.user?.name || session?.user?.email)}
        </span>
        <span className="hidden max-w-[140px] truncate sm:inline">{label}</span>
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 z-50 mt-2 w-56 origin-top-right overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-elevated',
            'animate-fade-in',
          )}
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium">{session?.user?.name || 'Admin'}</p>
            <p className="truncate text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
          <div className="py-1">
            <button
              role="menuitem"
              type="button"
              disabled
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground"
            >
              <UserIcon className="h-3.5 w-3.5" />
              Profile (coming soon)
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
