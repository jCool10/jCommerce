import type { OrderStatus, Currency } from '@jcool/contracts';
import { api } from './api-client';

// The order service returns a FLAT view shape (not the @jcool/contracts Order
// domain DTO). Source: apps/order-service/src/interfaces/http/order-view.mapper.ts.
export interface OrderItemView {
  id: string;
  skuId: string;
  quantity: number;
  unitAmount: number;
  currency: Currency;
}

export interface OrderView {
  id: string;
  userId: string;
  status: OrderStatus;
  items: OrderItemView[];
  totalAmount: number;
  currency: Currency;
  stripePaymentIntentId: string | null;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode: string;
    country: string;
  };
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OrdersPage = { items: OrderView[]; nextCursor: string | null };

export type ListOrdersParams = { limit?: number; cursor?: string };

export const ordersApi = {
  list: (params: ListOrdersParams = {}) => {
    const sp = new URLSearchParams();
    if (params.limit) sp.set('limit', String(params.limit));
    if (params.cursor) sp.set('cursor', params.cursor);
    const qs = sp.toString();
    return api.get<OrdersPage>(`/orders${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<OrderView>(`/orders/${id}`),
  updateStatus: (id: string, status: 'SHIPPED' | 'DELIVERED') =>
    api.patch<OrderView>(`/orders/${id}/status`, { status }),
};
