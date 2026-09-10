import { z } from 'zod';

export const menuFeedQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  cuisine: z.string().trim().max(50).optional(),
  restaurant_ids: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(12),
});
