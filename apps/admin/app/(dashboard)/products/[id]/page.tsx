'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductFormSheet } from '@/components/product-form';
import { productsApi } from '@/lib/api/products';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { openProductForm } from '@/lib/store/slices/modals.slice';
import { formatMoney } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProductDetailPage({ params }: PageProps): React.JSX.Element {
  const { id } = use(params);
  const dispatch = useAppDispatch();
  const formOpen = useAppSelector((s) => s.modals.productForm.open);

  const product = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.get(id),
  });

  if (product.isPending) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading product…
      </div>
    );
  }

  if (product.isError || !product.data) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-destructive">Failed to load product.</p>
          <Link
            href="/products"
            className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to products
          </Link>
        </CardContent>
      </Card>
    );
  }

  const p = product.data;
  const totalStock = p.skus.reduce((sum, s) => sum + s.stock, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to products
        </Link>
        <Button onClick={() => dispatch(openProductForm({ productId: id }))}>
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-xl">{p.name}</CardTitle>
              <CardDescription className="font-mono text-xs">/{p.slug}</CardDescription>
            </div>
            <Badge variant={p.isActive ? 'success' : 'secondary'}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {p.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {p.description ? (
            <p className="text-sm leading-relaxed text-foreground/80">{p.description}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">No description.</p>
          )}
          <dl className="grid grid-cols-3 gap-3 rounded-md border border-border bg-muted/20 p-3 text-sm sm:max-w-md">
            <div>
              <dt className="text-xs text-muted-foreground">SKUs</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{p.skus.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total stock</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{totalStock}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Images</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{p.images.length}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SKUs ({p.skus.length})</CardTitle>
          <CardDescription>USD and VND pricing per SKU with stock levels.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 text-left font-medium">SKU</th>
                  <th className="px-5 py-2 text-right font-medium">USD</th>
                  <th className="px-5 py-2 text-right font-medium">VND</th>
                  <th className="px-5 py-2 text-right font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {p.skus.map((s) => {
                  const usd = s.prices.find((pr) => pr.currency === 'USD');
                  const vnd = s.prices.find((pr) => pr.currency === 'VND');
                  return (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-2.5 font-mono text-xs">{s.sku}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {usd ? formatMoney(usd.amount, 'USD') : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {vnd ? formatMoney(vnd.amount, 'VND') : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        <span
                          className={
                            s.stock <= 5
                              ? 'rounded-md bg-warning/15 px-1.5 py-0.5 text-warning'
                              : ''
                          }
                        >
                          {s.stock}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {formOpen && <ProductFormSheet />}
    </div>
  );
}
