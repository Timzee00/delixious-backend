import { z } from 'zod';
import { BUSINESS_TYPES } from './restaurants.schema.js';

export const menuFeedQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  cuisine: z.string().trim().max(60).optional(),
  business_type: z.enum(BUSINESS_TYPES).optional(),
  open_only: z.enum(['true', 'false']).optional(),
  min_price: z.coerce.number().finite().min(0).optional(),
  max_price: z.coerce.number().finite().min(0).max(1000000).optional(),
  min_rating: z.coerce.number().finite().min(0).max(5).optional(),
  sort: z.enum(['newest', 'price_low', 'price_high', 'rating']).optional().default('newest'),
  restaurant_ids: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(12),
}).refine(
  query => query.min_price === undefined || query.max_price === undefined || query.min_price <= query.max_price,
  { path: ['max_price'], message: 'Maximum price must be greater than or equal to minimum price.' }
);
