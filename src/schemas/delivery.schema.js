import { z } from 'zod';

export const assignAgentSchema = z.object({
  delivery_agent_id: z.string().uuid('delivery_agent_id must be a valid id.'),
});

export const updateLocationSchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['picked_up', 'en_route', 'delivered']),
  proof_code: z.string().regex(/^\\d{6}$/, 'Enter the six-digit code from the customer.').optional(),
}).strict().superRefine((body, ctx) => {
  if (body.status === 'delivered' && !body.proof_code) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['proof_code'], message: 'A delivery code is required to finish the order.' });
  }
});

export const searchAgentsQuerySchema = z.object({
  phone: z.string().trim().min(3, "Provide at least 3 digits of the agent's phone number."),
});
