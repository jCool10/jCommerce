import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ChevronRight, Package, ShieldCheck, Truck } from 'lucide-react';
import { catalogApi } from '@/lib/api/catalog';
import { getCurrencyFromCookie } from '@/lib/server/get-currency';
import { pickFromPrice } from '@/lib/product-pricing';
import { PdpGallery } from '@/components/pdp-gallery';
import { PdpBuyBox } from '@/components/pdp-buy-box';
import { RelatedProducts } from '@/components/related-products';
import { ProductGridSkeleton } from '@/components/product-card-skeleton';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api-client';
import { safeJsonLd } from '@/lib/safe-json-ld';

interface PdpProps {
  params: { id: string };
}

export const revalidate = 60;

export async function generateMetadata({ params }: PdpProps): Promise<Metadata> {
  const currency = getCurrencyFromCookie();
  try {
    const product = await catalogApi.getById(params.id, currency, { server: true, revalidate });
    const price = pickFromPrice(product, currency);
    return {
      title: product.name,
      description: product.description.slice(0, 160),
      openGraph: {
        title: product.name,
        description: product.description.slice(0, 200),
        images: product.images.slice(0, 1),
        type: 'website',
      },
      other: price
        ? { 'product:price:amount': String(price.amount), 'product:price:currency': price.currency }
        : undefined,
    };
  } catch {
    return { title: 'Product' };
  }
}

export default async function ProductDetailPage({ params }: PdpProps): Promise<JSX.Element> {
  const currency = getCurrencyFromCookie();
  let product;
  try {
    product = await catalogApi.getById(params.id, currency, { server: true, revalidate });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const fromPrice = pickFromPrice(product, currency);
  const totalStock = product.skus.reduce((sum, sku) => sum + sku.stock, 0);
  const inStock = totalStock > 0;
  const jsonLd = buildJsonLd(product, fromPrice);

  return (
    <div className="pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <div className="container space-y-10 py-10">
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-fg"
        >
          <Link href="/" className="transition-colors hover:text-fg">
            Home
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/products" className="transition-colors hover:text-fg">
            Products
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="truncate text-fg">{product.name}</span>
        </nav>

        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <PdpGallery images={product.images} productName={product.name} />

          <div className="flex flex-col gap-8">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                {inStock ? <Badge tone="success">In stock</Badge> : <Badge tone="danger">Sold out</Badge>}
                {product.skus.length > 1 ? (
                  <Badge tone="neutral">
                    {product.skus.length} variants
                  </Badge>
                ) : null}
              </div>
              <h1 className="font-display text-3xl font-semibold tracking-tighter text-fg md:text-5xl">
                {product.name}
              </h1>
            </div>

            <PdpBuyBox product={product} currency={currency} />

            <ul className="grid grid-cols-1 gap-2 text-xs text-muted-fg sm:grid-cols-3">
              <li className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" /> Free shipping $50+
              </li>
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Secure checkout
              </li>
              <li className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> 30-day returns
              </li>
            </ul>

            <section className="space-y-3 border-t border-border pt-6">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
                About this product
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-fg/85">
                {product.description || 'No description provided yet.'}
              </p>
            </section>

            <section className="grid grid-cols-2 divide-x divide-y divide-border border border-border rounded-md text-xs sm:grid-cols-4 sm:divide-y-0">
              <Spec label="Variants" value={String(product.skus.length)} />
              <Spec label="Status" value={product.isActive ? 'Active' : 'Inactive'} />
              <Spec label="Stock" value={String(totalStock)} />
              <Spec label="Currency" value={currency} />
            </section>
          </div>
        </div>

        <Suspense fallback={<ProductGridSkeleton count={4} />}>
          <RelatedProducts
            categoryId={product.categoryId}
            excludeProductId={product.id}
            currency={currency}
          />
        </Suspense>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="space-y-1 p-4">
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-fg">
        {label}
      </dt>
      <dd className="font-display text-base font-semibold tracking-tight text-fg tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function buildJsonLd(
  product: Awaited<ReturnType<typeof catalogApi.getById>>,
  fromPrice: ReturnType<typeof pickFromPrice>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images,
    sku: product.skus[0]?.sku,
    offers: fromPrice
      ? {
          '@type': 'Offer',
          priceCurrency: fromPrice.currency,
          price: fromPrice.amount / (fromPrice.currency === 'USD' ? 100 : 1),
          availability: product.isActive
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        }
      : undefined,
  };
}
