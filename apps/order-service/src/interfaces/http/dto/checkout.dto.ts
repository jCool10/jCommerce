import { z } from 'zod';

export const CheckoutBodySchema = z.object({
  shippingAddress: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    region: z.string().optional(),
    postalCode: z.string().min(1),
    country: z.string().length(2),
  }),
});
export type CheckoutBody = z.infer<typeof CheckoutBodySchema>;

export const ListOrdersQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;

export const UpdateOrderStatusBodySchema = z.object({
  status: z.enum(['SHIPPED', 'DELIVERED']),
});
export type UpdateOrderStatusBody = z.infer<typeof UpdateOrderStatusBodySchema>;
