import { z } from 'zod';

// Multi-currency: USD (cents) + VND (đồng). Amount is integer subunit — never a float.
// Per plan validation V2: explicit prices per currency, no FX conversion.
export const CurrencySchema = z.enum(['USD', 'VND']);
export type Currency = z.infer<typeof CurrencySchema>;

export const MoneySchema = z.object({
  currency: CurrencySchema,
  amount: z.number().int().nonnegative(),
});
export type Money = z.infer<typeof MoneySchema>;
