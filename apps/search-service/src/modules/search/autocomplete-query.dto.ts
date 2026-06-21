import { z } from 'zod';

export const AutocompleteQuerySchema = z.object({
  q: z.string().min(1).max(50),
});
export type AutocompleteQuery = z.infer<typeof AutocompleteQuerySchema>;
