import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Heart } from 'lucide-react';
import type { Currency, Product } from '@jcool/contracts';
import { formatMoney } from '@/lib/money';
import { pickFromPrice } from '@/lib/product-pricing';
import { Badge } from './ui/badge';

interface ProductCardProps {
  product: Product;
  currency: Currency;
  /** Compact variant — tighter typography for sidebar lists. */
  compact?: boolean;
}

// Swiss product card: square image, hairline border, editorial typography.
// Hover lifts image (no card transform), reveals arrow chip.
export function ProductCard({ product, currency, compact = false }: ProductCardProps): JSX.Element {
  const fromPrice = pickFromPrice(product, currency);
  const image = product.images[0];
  const lowStock = product.skus.every((s) => s.stock < 5);

  return (
    <Link
      href={{ pathname: `/products/${product.id}` }}
      className="group relative flex flex-col rounded-md border border-border bg-bg transition-colors duration-200 hover:border-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-t-md bg-muted">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 300px"
            className="object-cover transition-transform duration-500 ease-swiss group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted">
            <span className="font-display text-5xl font-bold text-muted-fg/40">
              {product.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}

        {lowStock ? (
          <div className="absolute left-3 top-3">
            <Badge tone="warning">Low stock</Badge>
          </div>
        ) : null}

        {/* Wishlist hint — visual placeholder; real toggle wired in a later phase. */}
        <span
          aria-hidden="true"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-bg/80 text-fg backdrop-blur transition-colors group-hover:bg-bg group-hover:text-accent-500"
        >
          <Heart className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>

        <span
          aria-hidden="true"
          className="absolute bottom-3 right-3 flex h-9 w-9 translate-y-1 items-center justify-center rounded-sm bg-fg text-bg opacity-0 transition-all duration-200 ease-swiss group-hover:translate-y-0 group-hover:opacity-100"
        >
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>

      <div className={compact ? 'flex flex-col gap-2 p-3' : 'flex flex-1 flex-col gap-2 p-4'}>
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-fg">{product.name}</h3>
        <div className="mt-auto flex items-baseline justify-between gap-2 pt-1">
          <p className="font-display text-lg font-semibold tracking-tight text-fg tabular-nums">
            {fromPrice ? formatMoney(fromPrice) : '—'}
          </p>
          {fromPrice ? (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-fg">
              from
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
