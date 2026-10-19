import { z } from 'zod';
export const jobSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20).max(5000),
  location: z.string().trim().min(3).max(180),
  job_type: z.enum(['full_time','part_time','contract','internship']),
  published: z.boolean().default(false),
}).strict();
export const jobUpdateSchema = jobSchema.partial().strict();
export const jobApplicationSchema = z.object({
  applicant_name: z.string().trim().min(2).max(120),
  applicant_email: z.string().trim().email().max(254),
  applicant_phone: z.string().trim().max(30).optional(),
  cover_note: z.string().trim().min(20).max(4000),
  privacy_consent: z.literal(true),
}).strict();
export const applicationStatusSchema = z.object({
  status: z.enum(['reviewing','shortlisted','rejected']),
}).strict();
export const careersListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
