import { HttpStatus, PipeTransform } from '@nestjs/common';
import { ErrorCode } from '@zinu/shared';
import type { z } from 'zod';
import { AppError } from './errors.js';

/** Validates and transforms a request part with a shared Zod schema: `@Body(new ZodPipe(schema))`. */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      throw new AppError(ErrorCode.VALIDATION_FAILED, details[0]?.message ?? 'Invalid request', HttpStatus.BAD_REQUEST, details);
    }
    return result.data;
  }
}
