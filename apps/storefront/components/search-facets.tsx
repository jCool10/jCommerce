'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Check } from 'lucide-react';
import type { Facet } from '@jcool/contracts';
import { cn } from '@/lib/cn';

interface SearchFacetsProps {
  facets: Facet[];
}

export function SearchFacets({ facets }: SearchFacetsProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggle = useCallback(
    (field: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = params.get(field);
      if (current === value) {
        params.delete(field);
      } else {
        params.set(field, value);
      }
      router.push(`/search?${params.toString()}`);
    },
    [router, searchParams],
  );

  if (facets.length === 0) {
    return <aside className="hidden md:block" aria-hidden="true" />;
  }

  return (
    <aside className="space-y-8" aria-label="Refine search">
      <header className="flex items-baseline justify-between border-b border-border pb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-fg">Refine</h2>
        <span className="text-[10px] uppercase tracking-widest text-muted-fg">
          {facets.length} groups
        </span>
      </header>
      {facets.map((facet) => (
        <section key={facet.field}>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
            {facet.field}
          </h3>
          <ul className="space-y-1">
            {facet.buckets.map((bucket) => {
              const active = searchParams.get(facet.field) === bucket.key;
              return (
                <li key={bucket.key}>
                  <button
                    type="button"
                    onClick={() => toggle(facet.field, bucket.key)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'bg-fg text-bg'
                        : 'text-muted-fg hover:bg-muted hover:text-fg',
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                          active ? 'border-bg' : 'border-border bg-bg',
                        )}
                        aria-hidden="true"
                      >
                        {active ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="truncate">{bucket.key}</span>
                    </span>
                    <span className="text-[10px] font-semibold tabular-nums opacity-70">
                      {bucket.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </aside>
  );
}
