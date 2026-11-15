import { z } from 'zod';

export const menuFeedQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  cuisine: z.string().trim().max(50).optional(),
  category: z.string().trim().max(50).optional(),
  restaurant_ids: z.string().trim().optional(),
  min_price: z.coerce.number().finite().min(0).optional(),
  max_price: z.coerce.number().finite().min(0).optional(),
  min_rating: z.coerce.number().finite().min(0).max(5).optional(),
  sort: z.enum(['newest', 'price_low', 'price_high', 'rating']).optional().default('newest'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(12),
}).refine(
  (query) => query.min_price === undefined || query.max_price === undefined || query.min_price <= query.max_price,
  { path: ['max_price'], message: 'Maximum price must be greater than or equal to minimum price.' }
);
