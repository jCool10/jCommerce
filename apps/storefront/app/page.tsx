import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Sparkles, Flame, Tag } from 'lucide-react';
import { catalogApi } from '@/lib/api/catalog';
import { getCurrencyFromCookie } from '@/lib/server/get-currency';
import { ProductCard } from '@/components/product-card';
import { FeatureStrip } from '@/components/feature-strip';

// Home is ISR-cached for 5 minutes — featured products rarely change.
export const revalidate = 300;

export default async function HomePage(): Promise<JSX.Element> {
  const currency = getCurrencyFromCookie();
  const featured = await catalogApi
    .list({ limit: 8, currency }, { server: true, revalidate, tags: ['products'] })
    .catch(() => ({ items: [], nextCursor: null }));

  return (
    <div className="pb-24">
      {/* Hero — editorial typography on a 12-col grid; bento status block right */}
      <section className="border-b border-border">
        <div className="container grid gap-12 py-20 md:py-28 lg:grid-cols-12 lg:py-32">
          <div className="space-y-8 lg:col-span-7">
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
              <span className="h-px w-8 bg-fg" aria-hidden="true" />
              Summer edition · New arrivals
            </div>
            <h1 className="font-display text-[2.75rem] font-semibold leading-[1.02] tracking-tighter text-fg sm:text-6xl md:text-7xl">
              Objects worth
              <br />
              living{' '}
              <span className="italic text-accent-500">with.</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-fg md:text-lg">
              A small catalog of considered goods — chosen for craft, built to
              last, shipped fast. New drops every week, free shipping over $50,
              and a checkout that respects your time.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/products"
                className="group inline-flex h-12 items-center gap-2 rounded-md bg-fg px-6 text-sm font-semibold text-bg transition-colors hover:bg-brand-800 dark:hover:bg-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Shop the collection
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/search"
                className="inline-flex h-12 items-center gap-2 rounded-md border border-border bg-bg px-6 text-sm font-semibold text-fg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Search by name
              </Link>
            </div>
            <dl className="grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6 text-xs">
              <Stat label="Delivery" value="2–5d" />
              <Stat label="Returns" value="30d" />
              <Stat label="Support" value="24/7" />
            </dl>
          </div>

          {/* Curated collection teaser — right column on lg+ */}
          <div className="lg:col-span-5">
            <div className="flex h-full flex-col rounded-md border border-border bg-bg-elevated p-6">
              <header className="mb-5 flex items-center justify-between border-b border-border pb-3">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
                  Featured collections
                </span>
                <Link
                  href="/products"
                  className="font-mono text-[10px] uppercase tracking-widest text-muted-fg transition-colors hover:text-fg"
                >
                  View all
                </Link>
              </header>
              <ul className="flex flex-1 flex-col gap-2 text-sm">
                <CollectionRow
                  icon={Sparkles}
                  title="New this week"
                  meta="Fresh drops"
                  href="/products"
                />
                <CollectionRow
                  icon={Flame}
                  title="Best sellers"
                  meta="Most loved"
                  href="/products"
                  highlight
                />
                <CollectionRow
                  icon={Tag}
                  title="Last chance"
                  meta="Up to 30% off"
                  href="/products"
                />
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="py-20">
        <FeatureStrip />
      </div>

      {/* Featured products */}
      <section className="container space-y-8 pb-20">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-2">
            <p className="eyebrow">Featured this week</p>
            <h2 className="font-display text-3xl font-semibold tracking-tighter text-fg md:text-5xl">
              Hand-picked drops
            </h2>
          </div>
          <Link
            href="/products"
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-fg transition-colors hover:text-accent-500"
          >
            View all
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </header>
        {featured.items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-bg-elevated p-12 text-center">
            <p className="text-sm text-muted-fg">
              New drops are on the way. Check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.items.map((product) => (
              <ProductCard key={product.id} product={product} currency={currency} />
            ))}
          </div>
        )}
      </section>

      {/* CTA panel — inverted slab, brutally simple */}
      <section className="container">
        <div className="rounded-md bg-fg p-10 text-bg md:p-16">
          <div className="grid items-end gap-8 md:grid-cols-12">
            <div className="md:col-span-8 space-y-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-bg/60">
                Start your cart
              </p>
              <h2 className="font-display text-3xl font-semibold tracking-tighter md:text-5xl">
                Find something you&apos;ll love.
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-bg/75 md:text-base">
                Curated drops, secure checkout, multi-currency pricing. Add a
                few favourites to your cart and we&apos;ll handle the rest.
              </p>
              <ul className="grid gap-2 text-sm text-bg/75 sm:grid-cols-2">
                {[
                  'Hand-picked drops every week',
                  'Free shipping over $50',
                  '30-day easy returns',
                  'Pay in USD or VND',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-4 flex flex-col gap-3 md:items-end">
              <Link
                href="/products"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fg"
              >
                Start shopping
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/orders"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-bg/30 bg-transparent px-6 text-sm font-semibold text-bg transition-colors hover:bg-bg/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fg"
              >
                Your orders
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="space-y-1">
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-fg">
        {label}
      </dt>
      <dd className="font-display text-2xl font-semibold tracking-tighter text-fg tabular-nums">
        {value}
      </dd>
    </div>
  );
}

interface CollectionRowProps {
  icon: typeof Sparkles;
  title: string;
  meta: string;
  href: string;
  highlight?: boolean;
}

function CollectionRow({
  icon: Icon,
  title,
  meta,
  href,
  highlight,
}: CollectionRowProps): JSX.Element {
  return (
    <li>
      <Link
        href={{ pathname: href }}
        className="group flex flex-1 items-center justify-between gap-3 rounded-sm border border-transparent px-2 py-3 transition-colors hover:border-border hover:bg-bg"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border bg-bg text-fg">
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-fg">{title}</span>
            <span className="block truncate text-[11px] text-muted-fg">{meta}</span>
          </span>
        </span>
        <span
          className={
            highlight
              ? 'rounded-sm bg-accent-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent-500'
              : 'text-[11px] text-muted-fg transition-colors group-hover:text-fg'
          }
        >
          {highlight ? 'Hot' : 'Browse'}
        </span>
      </Link>
    </li>
  );
}
