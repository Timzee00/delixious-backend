import { z } from 'zod';

export const BUSINESS_TYPES = ["restaurant","bakery","cakes_desserts","parfait_yogurt","snacks_small_chops","ice_cream_frozen","drinks_beverages","catering","grocery_foods"] ;

const businessTypesSchema = z.array(z.enum(BUSINESS_TYPES))
  .min(1, 'Choose at least one business type.')
  .max(3, 'A food business can select up to three business types.')
  .refine(types => new Set(types).size === types.length, 'Business types must be unique.');

export const createRestaurantSchema = z.object({
  name: z.string().trim().min(1, 'name is required.').max(120),
  description: z.string().trim().max(1000).optional(),
  cuisine_type: z.string().trim().max(60).optional(),
  business_types: businessTypesSchema.optional().default(['restaurant']),
  address: z.string().trim().min(1, 'address is required.').max(300),
  lat: z.coerce.number().finite().min(-90).max(90).optional(),
  lng: z.coerce.number().finite().min(-180).max(180).optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  cover_image_url: z.string().url().optional().or(z.literal('')),
});

export const updateRestaurantSchema = createRestaurantSchema.partial();

export const listRestaurantsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  cuisine: z.string().trim().max(60).optional(),
  business_type: z.enum(BUSINESS_TYPES).optional(),
  is_open: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});

export const listMyRestaurantsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});
