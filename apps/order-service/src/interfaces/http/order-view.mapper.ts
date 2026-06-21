import type { Order } from '../../domain/order.entity.js';
import type { OrderItem } from '../../domain/order-item.entity.js';

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
  shippingAddress: Order['shippingAddress'];
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const itemView = (i: OrderItem): OrderItemView => ({
  id: i.id,
  skuId: i.skuId,
  quantity: i.quantity,
  unitAmount: i.unitAmount,
  currency: i.currency,
});

export const toOrderView = (order: Order): OrderView => ({
  id: order.id,
  userId: order.userId,
  status: order.status,
  items: order.items.map(itemView),
  totalAmount: order.totalAmount,
  currency: order.currency,
  stripePaymentIntentId: order.stripePaymentIntentId,
  shippingAddress: order.shippingAddress,
  cancelReason: order.cancelReason,
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
});
