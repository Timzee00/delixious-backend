import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  unread_only: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(30),
});
