import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates a request payload against a Zod schema, returning the parsed value
 * or throwing a 400 with a flattened error detail. Instantiated per-route:
 * `@Body(new ZodValidationPipe(MySchema))`.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: result.error.flatten(),
      });
    }
    return result.data;
  }
}
