import { z } from 'zod';
export const emailPreferencesSchema=z.object({
  order_updates_email:z.boolean(),
  promotional_email_opt_in:z.boolean(),
}).strict();
