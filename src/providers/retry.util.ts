/**
 * Purpose:
 * Exponential backoff retry utility.
 * Implements the retry strategy from the SDD: 3 attempts, 5s → 15s → 45s.
 *
 * Responsibilities:
 * - Execute async operations with retry on failure
 * - Apply exponential backoff between attempts
 * - Support custom retry configuration
 * - Pass through successful results, throw on exhaustion
 *
 * Dependencies:
 * - pino (logger)
 */

import { logger } from '@/lib/logger';

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in milliseconds (default: 5000) */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds (default: 45000) */
  maxDelayMs: number;
  /** Multiplier for exponential growth (default: 3) */
  backoffMultiplier: number;
  /** Optional: only retry if error matches this predicate */
  retryIf?: (error: Error) => boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 5000,
  maxDelayMs: 45000,
  backoffMultiplier: 3,
};

/**
 * Calculate delay for a given attempt using exponential backoff.
 *
 * Attempt 0 → 5,000ms
 * Attempt 1 → 15,000ms
 * Attempt 2 → 45,000ms
 */
export function calculateBackoff(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Execute an async operation with retry and exponential backoff.
 * Throws the last error if all retries are exhausted.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  operationName = 'operation',
): Promise<T> {
  const effectiveConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= effectiveConfig.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(
          { operation: operationName, attempt, maxRetries: effectiveConfig.maxRetries },
          'Retrying operation',
        );
      }
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this error type should be retried
      if (effectiveConfig.retryIf && !effectiveConfig.retryIf(lastError)) {
        logger.warn(
          { operation: operationName, error: lastError.message },
          'Non-retryable error, failing immediately',
        );
        throw lastError;
      }

      if (attempt < effectiveConfig.maxRetries) {
        const delay = calculateBackoff(attempt, effectiveConfig);
        logger.warn(
          {
            operation: operationName,
            attempt: attempt + 1,
            maxRetries: effectiveConfig.maxRetries,
            delayMs: delay,
            error: lastError.message,
          },
          'Operation failed, retrying after backoff',
        );
        await sleep(delay);
      }
    }
  }

  logger.error(
    {
      operation: operationName,
      maxRetries: effectiveConfig.maxRetries,
      error: lastError?.message,
    },
    'All retry attempts exhausted',
  );
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
