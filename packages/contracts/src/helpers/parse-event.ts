import type { z } from 'zod';

export class EventParseError extends Error {
  readonly issues: z.ZodIssue[];
  constructor(issues: z.ZodIssue[]) {
    super(`Event payload failed schema validation: ${issues.map((i) => i.message).join('; ')}`);
    this.name = 'EventParseError';
    this.issues = issues;
  }
}

// Thin wrapper that throws a typed error on validation failure.
// Consumers should catch EventParseError to route to DLQ / log + skip.
export function parseEvent<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new EventParseError(result.error.issues);
  }
  return result.data;
}
