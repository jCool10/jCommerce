'use client';

import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { closeProductForm } from '@/lib/store/slices/modals.slice';
import { productsApi, type CreateProductBody, type SkuInput } from '@/lib/api/products';
import { SkuEditor } from './sku-editor';

const ProductFormSchema = z.object({
  slug: z.string().min(1, 'required'),
  name: z.string().min(1, 'required'),
  description: z.string().default(''),
  categoryId: z.string().uuid('valid UUID required'),
  images: z.string().default(''),
  isActive: z.boolean().default(true),
  skus: z
    .array(
      z.object({
        sku: z.string().min(1),
        initialStock: z.number().int().nonnegative().default(0),
        attributesJson: z.string().default(''),
        prices: z.object({
          USD: z.number().int().nonnegative(),
          VND: z.number().int().nonnegative(),
        }),
      }),
    )
    .min(1, 'at least one SKU required'),
});

type ProductFormValues = z.infer<typeof ProductFormSchema>;

function parseAttributes(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        out[k] = String(v);
      }
      return out;
    }
  } catch {
    // empty object beats throwing in a form submit
  }
  return {};
}

function toCreateBody(v: ProductFormValues): CreateProductBody {
  const skus: SkuInput[] = v.skus.map((s) => ({
    sku: s.sku,
    attributes: parseAttributes(s.attributesJson),
    initialStock: s.initialStock,
    prices: [
      { currency: 'USD', unitAmount: s.prices.USD },
      { currency: 'VND', unitAmount: s.prices.VND },
    ],
  }));
  return {
    slug: v.slug,
    name: v.name,
    description: v.description,
    categoryId: v.categoryId,
    images: v.images
      ? v.images
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    isActive: v.isActive,
    skus,
  };
}

function FieldError({ msg }: { msg?: string }): React.JSX.Element | null {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive">{msg}</p>;
}

export function ProductFormSheet(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const { open, productId } = useAppSelector((s) => s.modals.productForm);
  const queryClient = useQueryClient();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(ProductFormSchema),
    defaultValues: {
      slug: '',
      name: '',
      description: '',
      categoryId: '',
      images: '',
      isActive: true,
      skus: [{ sku: '', attributesJson: '', initialStock: 0, prices: { USD: 0, VND: 0 } }],
    },
  });

  const existing = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productsApi.get(productId as string),
    enabled: !!productId,
  });

  useEffect(() => {
    if (existing.data) {
      const p = existing.data;
      form.reset({
        slug: p.slug,
        name: p.name,
        description: p.description,
        categoryId: p.categoryId,
        images: p.images.join(', '),
        isActive: p.isActive,
        skus: p.skus.map((s) => {
          const usd = s.prices.find((pr) => pr.currency === 'USD')?.amount ?? 0;
          const vnd = s.prices.find((pr) => pr.currency === 'VND')?.amount ?? 0;
          return {
            sku: s.sku,
            attributesJson:
              s.attributes && Object.keys(s.attributes).length > 0
                ? JSON.stringify(s.attributes)
                : '',
            initialStock: s.stock,
            prices: { USD: usd, VND: vnd },
          };
        }),
      });
    }
  }, [existing.data, form]);

  const createMutation = useMutation({
    mutationFn: (v: ProductFormValues) => productsApi.create(toCreateBody(v)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      dispatch(closeProductForm());
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (v: ProductFormValues) => {
      if (!productId) throw new Error('missing product id');
      const body = toCreateBody(v);
      await productsApi.update(productId, {
        slug: body.slug,
        name: body.name,
        description: body.description,
        categoryId: body.categoryId,
        images: body.images,
        isActive: body.isActive,
      });
      // Sequential so per-SKU errors surface against the specific row. The backend
      // does not roll back partials — re-submit on failure.
      for (const sku of body.skus) {
        await productsApi.upsertSku(productId, sku);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      dispatch(closeProductForm());
    },
  });

  const submitting = createMutation.isPending || updateMutation.isPending;
  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && dispatch(closeProductForm())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-3xl"
      >
        <SheetHeader className="border-b border-border bg-muted/30 px-6 py-4">
          <SheetTitle>{productId ? 'Edit product' : 'New product'}</SheetTitle>
          <SheetDescription>
            Provide product metadata and at least one SKU with USD + VND pricing.
          </SheetDescription>
        </SheetHeader>

        <FormProvider {...form}>
          <form
            className="flex flex-1 flex-col overflow-hidden"
            onSubmit={form.handleSubmit((v) =>
              productId ? updateMutation.mutate(v) : createMutation.mutate(v),
            )}
          >
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <section className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Identity
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" placeholder="Crewneck Tee" {...form.register('name')} />
                    <FieldError msg={errors.name?.message} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      placeholder="crewneck-tee"
                      className="font-mono text-xs"
                      {...form.register('slug')}
                    />
                    <FieldError msg={errors.slug?.message} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="categoryId">Category ID (UUID)</Label>
                  <Input
                    id="categoryId"
                    placeholder="00000000-0000-0000-0000-000000000000"
                    className="font-mono text-xs"
                    {...form.register('categoryId')}
                  />
                  <FieldError msg={errors.categoryId?.message} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Optional product description"
                    {...form.register('description')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="images">Images</Label>
                  <Input
                    id="images"
                    placeholder="https://… , https://…"
                    {...form.register('images')}
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated URLs.</p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    id="isActive"
                    type="checkbox"
                    className="h-4 w-4 rounded border-border accent-primary"
                    {...form.register('isActive')}
                  />
                  <span>Active (visible in storefront)</span>
                </label>
              </section>

              <section className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Inventory
                </h3>
                <SkuEditor name="skus" />
                {errors.skus && (
                  <p className="text-sm text-destructive">
                    {errors.skus.message ?? 'SKU validation failed'}
                  </p>
                )}
              </section>
            </div>

            <SheetFooter className="m-0 border-t border-border bg-muted/20 px-6 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => dispatch(closeProductForm())}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Saving…' : productId ? 'Save changes' : 'Create product'}
              </Button>
            </SheetFooter>
          </form>
        </FormProvider>
      </SheetContent>
    </Sheet>
  );
}
