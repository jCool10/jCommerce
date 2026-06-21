'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';

const baseCls =
  'inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg text-muted-fg transition-colors hover:text-fg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg';

export function ThemeToggle(): JSX.Element {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Placeholder until next-themes hydrates — prevents SSR/CSR flash.
  if (!mounted) {
    return (
      <span className={cn(baseCls)} aria-hidden="true">
        <Moon className="h-4 w-4" />
      </span>
    );
  }

  const isDark = (theme === 'system' ? resolvedTheme : theme) === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={baseCls}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
