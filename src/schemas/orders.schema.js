import { z } from 'zod';

export const checkoutSchema = z.object({
  delivery_address: z.string().trim().min(1, 'delivery_address is required.'),
  delivery_lat: z.coerce.number().optional(),
  delivery_lng: z.coerce.number().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});
