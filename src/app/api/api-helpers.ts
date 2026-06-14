/**
 * Purpose:
 * Shared API utilities for route handlers.
 * Provides consistent error responses, success responses, and validation.
 *
 * Responsibilities:
 * - Convert AppError to NextResponse with appropriate status
 * - Wrap successful data in consistent JSON envelope
 * - Parse and validate request bodies
 * - Handle unknown errors gracefully
 *
 * Dependencies:
 * - next/server
 * - @/lib/errors
 * - @/lib/logger
 * - zod
 */

import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { z } from 'zod';

/**
 * Standard API response envelope.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Return a successful response with data.
 */
export function success<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Return a 201 Created response with data.
 */
export function created<T>(data: T): NextResponse<ApiResponse<T>> {
  return success(data, 201);
}

/**
 * Return an error response from an AppError.
 */
export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>,
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, details },
    },
    { status },
  );
}

/**
 * Handle errors in route handlers.
 * Converts AppError and unknown errors to consistent responses.
 */
export function handleError(error: unknown): NextResponse<ApiResponse> {
  if (error instanceof AppError) {
    return errorResponse(error.code, error.message, error.statusCode, error.details);
  }

  if (error instanceof z.ZodError) {
    const details = error.issues.reduce<Record<string, string>>((acc, issue) => {
      acc[issue.path.join('.') || '_root'] = issue.message;
      return acc;
    }, {});
    return errorResponse('VALIDATION_ERROR', 'Validation failed', 400, details);
  }

  logger.error({ error: error instanceof Error ? error.message : 'Unknown' }, 'Unhandled API error');

  return errorResponse(
    'INTERNAL_ERROR',
    'An unexpected error occurred',
    500,
  );
}

/**
 * Parse and validate a JSON request body against a Zod schema.
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Invalid JSON in request body',
      statusCode: 400,
    });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw result.error; // Will be caught by handleError
  }

  return result.data;
}
