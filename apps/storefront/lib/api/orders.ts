import { apiFetch, type ApiRequestOptions } from '../api-client';

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string;
}

export interface OrderItemView {
  id: string;
  skuId: string;
  quantity: number;
  unitAmount: number;
  currency: string;
}

export interface OrderView {
  id: string;
  userId: string;
  status: string;
  items: OrderItemView[];
  totalAmount: number;
  currency: string;
  stripePaymentIntentId: string | null;
  shippingAddress: ShippingAddress;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrdersPage {
  items: OrderView[];
  nextCursor: string | null;
}

export interface CheckoutResponse {
  orderId: string;
  clientSecret: string;
}

export const orderApi = {
  async checkout(
    shippingAddress: ShippingAddress,
    options: ApiRequestOptions = {},
  ): Promise<CheckoutResponse> {
    return apiFetch<CheckoutResponse>('/checkout', {
      ...options,
      method: 'POST',
      body: { shippingAddress },
    });
  },

  async list(
    params: { cursor?: string; limit?: number } = {},
    options: ApiRequestOptions = {},
  ): Promise<OrdersPage> {
    const qs = new URLSearchParams();
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<OrdersPage>(`/orders${suffix}`, options);
  },

  async getById(id: string, options: ApiRequestOptions = {}): Promise<OrderView> {
    return apiFetch<OrderView>(`/orders/${id}`, options);
  },
};
