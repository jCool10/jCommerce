'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import type { Product } from '@jcool/contracts';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { productsApi } from '@/lib/api/products';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import {
  toggleProduct,
  setProductSelection,
  clearProductSelection,
} from '@/lib/store/slices/selection.slice';
import { setProductFilters } from '@/lib/store/slices/ui-filters.slice';
import {
  openBulkDeleteConfirm,
  closeBulkDeleteConfirm,
  openProductForm,
} from '@/lib/store/slices/modals.slice';
import { ProductFormSheet } from '@/components/product-form';
import { cn } from '@/lib/utils';

const FILTERS = [
  { label: 'All', value: null },
  { label: 'Active', value: true },
  { label: 'Inactive', value: false },
] as const;

export default function ProductsPage(): React.JSX.Element {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.uiFilters.products);
  const selected = useAppSelector((s) => s.selection.products);
  const bulkConfirmOpen = useAppSelector((s) => s.modals.bulkDeleteConfirm.open);
  const productFormOpen = useAppSelector((s) => s.modals.productForm.open);
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState(filters.search);

  const { data, isPending } = useQuery({
    queryKey: ['products', { search: filters.search, isActive: filters.isActive }],
    queryFn: () =>
      productsApi.list({
        search: filters.search || undefined,
        isActive: filters.isActive ?? undefined,
        limit: 50,
      }),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => productsApi.delete(id)));
    },
    onSuccess: () => {
      dispatch(clearProductSelection());
      dispatch(closeBulkDeleteConfirm());
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const allIds = useMemo(() => (data?.items ?? []).map((p) => p.id), [data]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            aria-label="Select all"
            className="h-4 w-4 rounded border-border accent-primary"
            checked={allSelected}
            onChange={(e) =>
              dispatch(setProductSelection(e.target.checked ? allIds : []))
            }
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.name}`}
            className="h-4 w-4 rounded border-border accent-primary"
            checked={selected.includes(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            onChange={() => dispatch(toggleProduct(row.original.id))}
          />
        ),
      },
      {
        accessorKey: 'name',
        header: 'Product',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="font-mono text-xs text-muted-foreground">/{row.original.slug}</span>
          </div>
        ),
      },
      {
        id: 'skus',
        header: 'SKUs',
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.skus.length}</span>
        ),
      },
      {
        id: 'stock',
        header: 'Stock',
        cell: ({ row }) => {
          const total = row.original.skus.reduce((sum, s) => sum + s.stock, 0);
          const low = total <= 5;
          return (
            <span
              className={cn(
                'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
                low ? 'bg-warning/15 text-warning' : 'bg-muted text-foreground/80',
              )}
            >
              {total}
            </span>
          );
        },
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {row.original.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    [allIds, allSelected, dispatch, selected],
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Catalog with SKUs, multi-currency prices, and inventory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => dispatch(openBulkDeleteConfirm())}
            >
              <Trash2 className="h-4 w-4" />
              Delete {selected.length}
            </Button>
          )}
          <Button onClick={() => dispatch(openProductForm({ productId: null }))}>
            <Plus className="h-4 w-4" />
            New product
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 shadow-soft">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or slug…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') dispatch(setProductFilters({ search: searchInput }));
            }}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dispatch(setProductFilters({ search: searchInput }))}
        >
          Search
        </Button>
        <div className="ml-auto inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5">
          {FILTERS.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => dispatch(setProductFilters({ isActive: opt.value }))}
              className={cn(
                'rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors focus-ring',
                filters.isActive === opt.value
                  ? 'bg-background text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isPending}
        emptyTitle="No products"
        emptyMessage={filters.search ? 'Try a different search term.' : 'Click “New product” to add your first one.'}
        onRowClick={(p) => router.push(`/products/${p.id}`)}
      />

      <Dialog
        open={bulkConfirmOpen}
        onOpenChange={(open) => !open && dispatch(closeBulkDeleteConfirm())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected.length} products?</DialogTitle>
            <DialogDescription>
              This permanently removes the selected products and their SKUs. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => dispatch(closeBulkDeleteConfirm())}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={bulkDelete.isPending}
              onClick={() => bulkDelete.mutate(selected)}
            >
              {bulkDelete.isPending ? 'Deleting…' : `Delete ${selected.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {productFormOpen && <ProductFormSheet />}
    </div>
  );
}
