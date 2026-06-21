'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps): JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container py-24">
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-md border border-border bg-bg-elevated p-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-sm border border-danger-500/30 bg-danger-100 text-danger-600">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tighter text-fg">
            Something went wrong
          </h1>
          <p className="max-w-xs text-sm text-muted-fg">{error.message}</p>
        </div>
        <Button variant="brand" onClick={reset} leadingIcon={<RefreshCw className="h-4 w-4" />}>
          Try again
        </Button>
      </div>
    </div>
  );
}
