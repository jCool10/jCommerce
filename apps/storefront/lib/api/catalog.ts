import type { Currency, Product } from '@jcool/contracts';
import { apiFetch, withCurrency, type ApiRequestOptions } from '../api-client';

export interface ProductListPage {
  items: Product[];
  nextCursor: string | null;
}

export interface ListProductsParams {
  limit?: number;
  cursor?: string;
  categoryId?: string;
  search?: string;
  currency?: Currency;
}

export const catalogApi = {
  async list(params: ListProductsParams, options: ApiRequestOptions = {}): Promise<ProductListPage> {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.categoryId) qs.set('categoryId', params.categoryId);
    if (params.search) qs.set('search', params.search);
    qs.set('currency', params.currency ?? 'USD');
    return apiFetch<ProductListPage>(`/products?${qs.toString()}`, options);
  },

  async getById(
    id: string,
    currency: Currency,
    options: ApiRequestOptions = {},
  ): Promise<Product> {
    return apiFetch<Product>(withCurrency(`/products/${id}`, currency), options);
  },
};
