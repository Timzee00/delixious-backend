import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Query parameter "q" must be at least 2 characters.'),
});
