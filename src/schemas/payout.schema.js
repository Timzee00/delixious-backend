import { z } from 'zod';

export const bankDetailsSchema = z.object({
  bank_name: z.string().trim().min(1, 'bank_name is required.'),
  bank_code: z.string().trim().min(1, 'bank_code is required.'),
  account_number: z.string().trim().length(10, 'account_number must be 10 digits.'),
});
