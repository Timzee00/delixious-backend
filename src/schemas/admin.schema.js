import { z } from 'zod';

export const approvalStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export const suspendUserSchema = z.object({
  suspended: z.boolean(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});

export const listRestaurantsAdminQuerySchema = listQuerySchema.extend({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export const listUsersAdminQuerySchema = listQuerySchema.extend({
  role: z.enum(['customer', 'restaurant_owner', 'delivery_agent', 'admin']).optional(),
});

export const broadcastSchema = z.object({
  title: z.string().trim().min(1, 'title is required.'),
  message: z.string().trim().min(1, 'message is required.'),
  role: z.enum(['customer', 'restaurant_owner', 'delivery_agent']).optional(),
});
