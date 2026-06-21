import { z } from 'zod';

// Uniform error response across all services + gateway.
// Inspired by RFC 7807 Problem Details but slimmed for internal use.
export const HttpErrorResponseSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  error: z.string().min(1),
  message: z.string().min(1),
  correlationId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type HttpErrorResponse = z.infer<typeof HttpErrorResponseSchema>;
