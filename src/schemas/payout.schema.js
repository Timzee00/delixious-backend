import { z } from 'zod';

export const bankDetailsSchema = z.object({
  bank_name: z.string().trim().min(1, 'bank_name is required.'),
  bank_code: z.string().trim().min(1, 'bank_code is required.'),
  account_number: z.string().trim().length(10, 'account_number must be 10 digits.'),
});

// Restaurant owner payout setup uses the verified bank directory instead of a
// user-provided bank name; bank name comes from Paystack on the server.
export const restaurantBankDetailsSchema = z.object({
  bank_code: z.string().trim().regex(/^[0-9A-Za-z-]{1,12}$/, 'Choose a valid bank.'),
  account_number: z.string().trim().regex(/^\d{10}$/, 'Account number must contain exactly 10 digits.'),
});
