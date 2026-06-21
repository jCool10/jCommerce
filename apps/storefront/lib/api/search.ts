import type { Currency, SearchResponse } from '@jcool/contracts';
import { apiFetch, type ApiRequestOptions } from '../api-client';

export interface SearchParams {
  q: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  page?: number;
  pageSize?: number;
  currency?: Currency;
}

export const searchApi = {
  async query(params: SearchParams, options: ApiRequestOptions = {}): Promise<SearchResponse> {
    const qs = new URLSearchParams();
    qs.set('q', params.q);
    if (params.categoryId) qs.set('categoryId', params.categoryId);
    if (params.minPrice !== undefined) qs.set('minPrice', String(params.minPrice));
    if (params.maxPrice !== undefined) qs.set('maxPrice', String(params.maxPrice));
    if (params.sort) qs.set('sort', params.sort);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params.currency) qs.set('currency', params.currency);
    return apiFetch<SearchResponse>(`/search?${qs.toString()}`, options);
  },
};
