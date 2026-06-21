import Image from 'next/image';
import Link from 'next/link';
import { Search as SearchIcon } from 'lucide-react';
import { searchApi } from '@/lib/api/search';
import { getCurrencyFromCookie } from '@/lib/server/get-currency';
import { formatMoney } from '@/lib/money';
import { SearchBar } from '@/components/search-bar';
import { SearchFacets } from '@/components/search-facets';

interface SearchPageProps {
  searchParams: {
    q?: string;
    sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
    page?: string;
    categoryId?: string;
    minPrice?: string;
    maxPrice?: string;
  };
}

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: SearchPageProps): Promise<JSX.Element> {
  const currency = getCurrencyFromCookie();
  const page = Number(searchParams.page ?? '1') || 1;
  const result = await searchApi
    .query(
      {
        q: searchParams.q ?? '',
        sort: searchParams.sort ?? 'relevance',
        page,
        pageSize: 20,
        currency,
        categoryId: searchParams.categoryId,
        minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
        maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
      },
      { server: true },
    )
    .catch(() => ({ total: 0, page, pageSize: 20, hits: [], facets: [] }));

  return (
    <div className="pb-24">
      <section className="border-b border-border">
        <div className="container space-y-6 py-16">
          <p className="eyebrow">Search</p>
          <h1 className="font-display text-4xl font-semibold tracking-tighter text-fg md:text-6xl">
            Find what you&rsquo;re <span className="italic text-accent-500">looking for.</span>
          </h1>
          <SearchBar />
          <p className="text-sm text-muted-fg">
            {result.total === 0
              ? searchParams.q
                ? `No results for "${searchParams.q}".`
                : 'Type a query to search the catalog.'
              : (
                  <>
                    <span className="font-semibold text-fg tabular-nums">{result.total}</span>{' '}
                    result{result.total === 1 ? '' : 's'} for{' '}
                    <span className="font-semibold text-fg">&ldquo;{searchParams.q ?? ''}&rdquo;</span>
                  </>
                )}
          </p>
        </div>
      </section>

      <div className="container grid gap-10 py-12 lg:grid-cols-[220px_1fr] lg:gap-14">
        <SearchFacets facets={result.facets} />

        {result.hits.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-bg-elevated p-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-sm border border-border text-muted-fg">
              <SearchIcon className="h-5 w-5" />
            </span>
            <p className="font-display text-lg font-semibold tracking-tight text-fg">
              Nothing matches yet
            </p>
            <p className="max-w-xs text-sm text-muted-fg">
              Try a broader query or remove filters to see more results.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.hits.map((hit) => (
              <Link
                key={hit.productId}
                href={{ pathname: `/products/${hit.productId}` }}
                className="group flex gap-4 rounded-md border border-border bg-bg p-3 transition-colors hover:border-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-sm bg-muted">
                  {hit.image ? (
                    <Image
                      src={hit.image}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover transition-transform duration-300 ease-swiss group-hover:scale-[1.04]"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 space-y-2 py-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-fg">{hit.name}</p>
                  <p className="font-display text-base font-semibold tracking-tight text-fg tabular-nums">
                    {formatMoney(hit.fromPrice)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
