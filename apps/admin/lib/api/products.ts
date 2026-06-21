import type { Product } from '@jcool/contracts';
import { api } from './api-client';

export type ListProductsParams = {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  currency?: 'USD' | 'VND';
  limit?: number;
  cursor?: string;
};

export type ProductsPage = { items: Product[]; nextCursor: string | null };

export type SkuPriceInput = { currency: 'USD' | 'VND'; unitAmount: number };

export type SkuInput = {
  sku: string;
  attributes?: Record<string, string>;
  prices: SkuPriceInput[];
  initialStock?: number;
};

export type CreateProductBody = {
  slug: string;
  name: string;
  description?: string;
  categoryId: string;
  images?: string[];
  isActive?: boolean;
  skus: SkuInput[];
};

export type UpdateProductBody = Partial<Omit<CreateProductBody, 'skus'>>;

export type UpsertSkuBody = SkuInput & { skuId?: string };

function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const productsApi = {
  list: (params: ListProductsParams = {}) =>
    api.get<ProductsPage>(`/products${buildQuery(params)}`),
  get: (id: string, currency: 'USD' | 'VND' = 'USD') =>
    // include_inactive=true so the editor can still load deactivated products;
    // public storefront requests omit it and get 404 for inactive items.
    api.get<Product>(`/products/${id}${buildQuery({ currency, include_inactive: 'true' })}`),
  create: (body: CreateProductBody) => api.post<Product>('/products', body),
  update: (id: string, body: UpdateProductBody) => api.put<Product>(`/products/${id}`, body),
  delete: (id: string) => api.delete(`/products/${id}`),
  upsertSku: (productId: string, body: UpsertSkuBody) =>
    api.put<{ skuId: string }>(`/products/${productId}/skus`, body),
};
