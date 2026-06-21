import Link from 'next/link';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound(): JSX.Element {
  return (
    <div className="container py-24">
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-md border border-border bg-bg-elevated p-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-sm border border-border bg-bg text-fg">
          <Compass className="h-6 w-6" />
        </span>
        <div className="space-y-2">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
            404
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tighter text-fg">
            Page not found
          </h1>
          <p className="text-sm text-muted-fg">
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
        <Link
          href="/"
          className="mt-1 inline-flex h-10 items-center gap-2 rounded-md bg-fg px-5 text-sm font-semibold text-bg transition-colors hover:bg-brand-800 dark:hover:bg-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <ArrowLeft className="h-4 w-4" />
          Back home
        </Link>
      </div>
    </div>
  );
}
