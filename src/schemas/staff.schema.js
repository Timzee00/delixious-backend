import { z } from 'zod';

export const staffInviteSchema = z.object({
  email: z.string().trim().email().max(254),
  staff_role: z.enum(['manager','kitchen','counter']),
}).strict();
export const acceptStaffInviteSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();
export const staffUpdateSchema = z.object({
  active: z.boolean().optional(),
  staff_role: z.enum(['manager','kitchen','counter']).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Specify a change.');
export const staffOrderStatusSchema = z.object({
  status: z.enum(['confirmed','preparing']),
}).strict();
export const staffListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
