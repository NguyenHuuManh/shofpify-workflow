/**
 * Purpose:
 * Validation helper that wraps Zod parsing and converts errors to AppError.
 *
 * Responsibilities:
 * - Parse with Zod schema
 * - Convert ZodError to AppError with VALIDATION_ERROR code
 * - Ensure all validation errors are AppError instances
 *
 * Dependencies:
 * - zod
 * - @/lib/errors
 */

import { z } from 'zod';
import { AppError, ErrorCodes } from './errors';

/**
 * Parse and validate input against a Zod schema.
 * Throws AppError with VALIDATION_ERROR code on failure.
 * Returns z.output<T> (with defaults applied, not z.infer<T>).
 */
export function validate<T extends z.ZodSchema>(
  schema: T,
  input: unknown,
): z.output<T> {
  const result = schema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues.reduce<Record<string, string>>(
      (acc, issue) => {
        const path = issue.path.join('.');
        acc[path || '_root'] = issue.message;
        return acc;
      },
      {},
    );

    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Validation failed',
      statusCode: 400,
      details,
    });
  }

  return result.data;
}
