import { z } from 'zod';

export const assignAgentSchema = z.object({
  delivery_agent_id: z.string().uuid('delivery_agent_id must be a valid id.'),
});

export const updateLocationSchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['assigned', 'picked_up', 'en_route', 'delivered']),
});

export const searchAgentsQuerySchema = z.object({
  phone: z.string().trim().min(3, "Provide at least 3 digits of the agent's phone number."),
});
