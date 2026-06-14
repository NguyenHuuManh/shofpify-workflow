/**
 * Purpose:
 * Unit tests for retry utility.
 * Validates exponential backoff calculation and retry behavior.
 *
 * Dependencies:
 * - vitest
 * - retry.util
 */

import { describe, it, expect, vi } from 'vitest';
import {
  withRetry,
  calculateBackoff,
  DEFAULT_RETRY_CONFIG,
} from '@/providers/retry.util';

describe('calculateBackoff', () => {
  it('should return base delay for attempt 0', () => {
    expect(calculateBackoff(0, DEFAULT_RETRY_CONFIG)).toBe(5000);
  });

  it('should return 3x base delay for attempt 1', () => {
    expect(calculateBackoff(1, DEFAULT_RETRY_CONFIG)).toBe(15000);
  });

  it('should return 9x base delay for attempt 2', () => {
    expect(calculateBackoff(2, DEFAULT_RETRY_CONFIG)).toBe(45000);
  });

  it('should cap at maxDelayMs', () => {
    const config = { ...DEFAULT_RETRY_CONFIG, maxDelayMs: 20000 };
    expect(calculateBackoff(2, config)).toBe(20000);
  });
});

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    const result = await withRetry(operation, { maxRetries: 2 }, 'test');
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('eventual success');

    const result = await withRetry(
      operation,
      { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 20 },
      'test',
    );

    expect(result).toBe('eventual success');
    expect(operation).toHaveBeenCalledTimes(3);
  }, 10000);

  it('should throw after exhausting all retries', async () => {
    const error = new Error('Persistent failure');
    const operation = vi.fn().mockRejectedValue(error);

    await expect(
      withRetry(operation, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 20 }, 'test'),
    ).rejects.toThrow('Persistent failure');

    expect(operation).toHaveBeenCalledTimes(3);
  }, 10000);

  it('should not retry if retryIf returns false', async () => {
    const error = new Error('Unauthorized');
    const operation = vi.fn().mockRejectedValue(error);

    await expect(
      withRetry(
        operation,
        {
          maxRetries: 3,
          baseDelayMs: 100,
          retryIf: (err) => !err.message.includes('Unauthorized'),
        },
        'test',
      ),
    ).rejects.toThrow('Unauthorized');

    expect(operation).toHaveBeenCalledTimes(1);
  }, 5000);
});
