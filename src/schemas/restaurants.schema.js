import { z } from 'zod';

export const createRestaurantSchema = z.object({
  name: z.string().trim().min(1, 'name is required.'),
  description: z.string().trim().optional(),
  cuisine_type: z.string().trim().optional(),
  address: z.string().trim().min(1, 'address is required.'),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  cover_image_url: z.string().url().optional().or(z.literal('')),
});

export const updateRestaurantSchema = createRestaurantSchema.partial();

export const listRestaurantsQuerySchema = z.object({
  search: z.string().trim().optional(),
  cuisine: z.string().trim().optional(),
  is_open: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});
