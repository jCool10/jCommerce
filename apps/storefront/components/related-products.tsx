import type { Currency } from '@jcool/contracts';
import { catalogApi } from '@/lib/api/catalog';
import { ProductCard } from './product-card';

interface RelatedProductsProps {
  categoryId: string;
  /** Current product id — filtered out of the related list. */
  excludeProductId: string;
  currency: Currency;
}

// Server-rendered "More from this collection" strip. Falls back silently
// (renders nothing) if catalog fetch fails or yields no neighbours.
export async function RelatedProducts({
  categoryId,
  excludeProductId,
  currency,
}: RelatedProductsProps): Promise<JSX.Element | null> {
  const page = await catalogApi
    .list(
      { limit: 8, categoryId, currency },
      { server: true, revalidate: 300, tags: ['products'] },
    )
    .catch(() => ({ items: [], nextCursor: null }));

  const items = page.items.filter((p) => p.id !== excludeProductId).slice(0, 4);
  if (items.length === 0) return null;

  return (
    <section className="container space-y-6 pt-16">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <p className="eyebrow">More from this collection</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-fg md:text-3xl">
            You might also like
          </h2>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} currency={currency} />
        ))}
      </div>
    </section>
  );
}
