import type { Currency } from '@jcool/contracts';
import { apiFetch, type ApiRequestOptions } from '../api-client';

// Mirrors order-service GetCartUseCase.CartView shape exactly so the storefront
// can lift it into Zustand state without re-mapping fields.
export interface CartLineView {
  skuId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitAmount: number;
  currency: Currency;
  lineTotal: number;
}

export interface CartView {
  sessionKey: string;
  currency: Currency | null;
  items: CartLineView[];
  subtotalAmount: number;
}

export interface AddToCartInput {
  productId: string;
  skuId: string;
  quantity: number;
  currency: Currency;
}

export const cartApi = {
  async get(options: ApiRequestOptions = {}): Promise<CartView> {
    return apiFetch<CartView>('/cart', options);
  },

  async add(input: AddToCartInput, options: ApiRequestOptions = {}): Promise<CartView> {
    return apiFetch<CartView>('/cart/items', {
      ...options,
      method: 'POST',
      body: input,
    });
  },

  async updateQuantity(
    skuId: string,
    quantity: number,
    options: ApiRequestOptions = {},
  ): Promise<CartView> {
    return apiFetch<CartView>(`/cart/items/${skuId}`, {
      ...options,
      method: 'PUT',
      body: { quantity },
    });
  },

  async remove(skuId: string, options: ApiRequestOptions = {}): Promise<CartView> {
    return apiFetch<CartView>(`/cart/items/${skuId}`, {
      ...options,
      method: 'DELETE',
    });
  },

  async clear(options: ApiRequestOptions = {}): Promise<void> {
    return apiFetch<void>('/cart', { ...options, method: 'DELETE' });
  },

  async merge(
    guestSessionId: string,
    options: ApiRequestOptions = {},
  ): Promise<CartView & { conflictDropped: boolean }> {
    return apiFetch<CartView & { conflictDropped: boolean }>('/cart/merge', {
      ...options,
      method: 'POST',
      body: { guestSessionKey: guestSessionId },
    });
  },
};
