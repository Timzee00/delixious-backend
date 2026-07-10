import { z } from 'zod';

export const createMenuItemSchema = z.object({
  name: z.string().trim().min(1, 'name is required.'),
  description: z.string().trim().optional(),
  price: z.coerce.number().min(0, 'price cannot be negative.'),
  image_url: z.string().url().optional().or(z.literal('')),
  category: z.string().trim().optional(),
  is_available: z.boolean().optional().default(true),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();
