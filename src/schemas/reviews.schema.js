import { z } from 'zod';

export const createReviewSchema = z.object({
  order_id: z.string().uuid('order_id must be a valid id.'),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const updateReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(1000).optional(),
});

export const listReviewsQuerySchema = z.object({
  // Cursor mode is used for restaurant-facing review lists. The optional page
  // parameter remains available for the older customer review-history route.
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  cursor: z.string().trim().min(1).max(512).optional(),
});
