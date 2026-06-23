/**
 * Purpose:
 * Centralized error handling for the entire platform.
 * All errors thrown in the application must use AppError.
 * Never throw raw Error objects.
 *
 * Responsibilities:
 * - Standardize error codes and status codes
 * - Provide structured error objects
 * - Support error serialization for API responses
 *
 * Dependencies:
 * - None (zero-dependency utility)
 */

export interface AppErrorPayload {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(payload: AppErrorPayload) {
    super(payload.message);
    this.name = 'AppError';
    this.code = payload.code;
    this.statusCode = payload.statusCode;
    this.details = payload.details;

    // Maintain proper stack trace
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON(): AppErrorPayload {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// -----------------------------------------------------------------------------
// Common Error Codes
// -----------------------------------------------------------------------------

export const ErrorCodes = {
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // Not Found
  NOT_FOUND: 'NOT_FOUND',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Workflow
  WORKFLOW_ALREADY_RUNNING: 'WORKFLOW_ALREADY_RUNNING',
  WORKFLOW_NOT_PENDING_REVIEW: 'WORKFLOW_NOT_PENDING_REVIEW',
  INVALID_WORKFLOW_TRANSITION: 'INVALID_WORKFLOW_TRANSITION',

  // Publishing
  PUBLISH_NOT_APPROVED: 'PUBLISH_NOT_APPROVED',
  PUBLISH_FAILED: 'PUBLISH_FAILED',

  // External Services
  SHOPIFY_API_ERROR: 'SHOPIFY_API_ERROR',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  REDIS_ERROR: 'REDIS_ERROR',

  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  CONFLICT: 'CONFLICT',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
