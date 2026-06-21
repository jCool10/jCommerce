import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowRight, PackageSearch, Search as SearchIcon } from 'lucide-react';
import type { Currency } from '@jcool/contracts';
import { catalogApi } from '@/lib/api/catalog';
import { getCurrencyFromCookie } from '@/lib/server/get-currency';
import { ProductCard } from '@/components/product-card';
import { ProductGridSkeleton } from '@/components/product-card-skeleton';
import { EmptyState } from '@/components/empty-state';
import { Input } from '@/components/ui/input';

interface ProductsPageProps {
  searchParams: {
    cursor?: string;
    search?: string;
  };
}

export const revalidate = 60;

export default function ProductsPage({ searchParams }: ProductsPageProps): JSX.Element {
  const currency = getCurrencyFromCookie();
  // Suspense key ensures the skeleton fallback re-shows on filter/page change.
  const suspenseKey = `${searchParams.search ?? ''}|${searchParams.cursor ?? ''}|${currency}`;

  return (
    <div className="pb-24">
      <section className="border-b border-border">
        <div className="container flex flex-col gap-8 py-16 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4 lg:max-w-2xl">
            <p className="eyebrow">Catalog</p>
            <h1 className="font-display text-4xl font-semibold tracking-tighter text-fg md:text-6xl">
              {searchParams.search ? (
                <>
                  Results for{' '}
                  <span className="italic text-accent-500">
                    &ldquo;{searchParams.search}&rdquo;
                  </span>
                </>
              ) : (
                'All products'
              )}
            </h1>
            <p className="text-sm text-muted-fg">
              Prices in <span className="font-semibold text-fg">{currency}</span>
            </p>
          </div>

          <form action="/products" className="flex w-full max-w-sm gap-2">
            <Input
              type="search"
              name="search"
              defaultValue={searchParams.search ?? ''}
              placeholder="Filter by name…"
              leadingIcon={<SearchIcon className="h-4 w-4" />}
              aria-label="Filter products by name"
            />
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-bg px-4 text-sm font-semibold text-fg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            >
              Filter
            </button>
          </form>
        </div>
      </section>

      <div className="container space-y-10 py-12">
        <Suspense key={suspenseKey} fallback={<ProductGridSkeleton count={12} />}>
          <ProductGrid
            cursor={searchParams.cursor}
            search={searchParams.search}
            currency={currency}
          />
        </Suspense>
      </div>
    </div>
  );
}

interface ProductGridProps {
  cursor?: string;
  search?: string;
  currency: Currency;
}

async function ProductGrid({ cursor, search, currency }: ProductGridProps): Promise<JSX.Element> {
  const page = await catalogApi
    .list(
      { limit: 24, cursor, search, currency },
      { server: true, revalidate, tags: ['products'] },
    )
    .catch(() => ({ items: [], nextCursor: null }));

  if (page.items.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title={search ? 'No matching products' : 'No products yet'}
        body={
          search
            ? 'Try a different keyword, or browse all products.'
            : 'New drops are on the way. Check back soon.'
        }
        cta={{ href: '/products', label: search ? 'Browse all' : 'Back home' }}
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {page.items.map((product) => (
          <ProductCard key={product.id} product={product} currency={currency} />
        ))}
      </div>

      {page.nextCursor ? (
        <div className="flex justify-center pt-4">
          <Link
            href={{
              pathname: '/products',
              query: {
                cursor: page.nextCursor,
                ...(search ? { search } : {}),
              },
            }}
            className="group inline-flex h-11 items-center gap-2 rounded-md border border-border bg-bg px-6 text-sm font-semibold uppercase tracking-wider text-fg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Load more
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      ) : null}
    </>
  );
}
