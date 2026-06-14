/**
 * Purpose:
 * Unit tests for BaseAIProvider abstract class.
 * Tests retry, usage tracking, error wrapping, and cost estimation.
 *
 * Dependencies:
 * - vitest
 * - BaseAIProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAIProvider } from '@/providers/base-ai-provider';
import { AppError } from '@/lib/errors';
import type { GenerateTextInput, GenerateTextOutput } from '@/types/ai-provider.interface';

/**
 * Concrete test provider that simulates API behavior.
 */
class TestProvider extends BaseAIProvider {
  readonly providerName = 'test';
  private mockCallAPI = vi.fn();

  setMockCall(fn: (input: GenerateTextInput) => Promise<GenerateTextOutput>): void {
    this.mockCallAPI = vi.fn(fn);
  }

  protected getDefaultModel(): string {
    return 'test-model-v1';
  }

  protected async callAPI(input: GenerateTextInput): Promise<GenerateTextOutput> {
    return this.mockCallAPI(input);
  }
}

const mockOutput: GenerateTextOutput = {
  text: 'Generated response',
  model: 'test-model-v1',
  usage: {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
  },
};

describe('BaseAIProvider', () => {
  let provider: TestProvider;

  beforeEach(() => {
    provider = new TestProvider({ retry: { baseDelayMs: 10, maxDelayMs: 20 } });
    // Mock the trackUsage call
    vi.spyOn(provider as never, 'trackUsage').mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------------------
  // generateText - Success
  // ---------------------------------------------------------------------------

  describe('generateText', () => {
    it('should return output on successful API call', async () => {
      provider.setMockCall(async () => mockOutput);

      const result = await provider.generateText({ prompt: 'Hello' });

      expect(result).toEqual(mockOutput);
      expect(result.text).toBe('Generated response');
    });

    it('should pass through model selection', async () => {
      let capturedModel: string | undefined;
      provider.setMockCall(async (input) => {
        capturedModel = input.model;
        return mockOutput;
      });

      await provider.generateText({ prompt: 'Hello', model: 'claude-3-opus-20240229' });

      expect(capturedModel).toBe('claude-3-opus-20240229');
    });

    // -------------------------------------------------------------------------
    // Error Handling
    // -------------------------------------------------------------------------

    it('should wrap unknown errors in AppError', async () => {
      provider.setMockCall(async () => {
        throw new Error('Network timeout');
      });

      await expect(
        provider.generateText({ prompt: 'Hello' }),
      ).rejects.toThrow(AppError);

      try {
        await provider.generateText({ prompt: 'Hello' });
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        if (error instanceof AppError) {
          expect(error.code).toBe('AI_PROVIDER_ERROR');
          expect(error.statusCode).toBe(502);
        }
      }
    });

    it('should pass through existing AppError', async () => {
      const originalError = new AppError({
        code: 'AI_PROVIDER_ERROR',
        message: 'Original error',
        statusCode: 502,
      });

      provider.setMockCall(async () => {
        throw originalError;
      });

      await expect(
        provider.generateText({ prompt: 'Hello' }),
      ).rejects.toThrow(originalError);
    });

    // -------------------------------------------------------------------------
    // Retry
    // -------------------------------------------------------------------------

    it('should retry on transient failures', async () => {
      provider.setMockCall(
        vi
          .fn()
          .mockRejectedValueOnce(new Error('Rate limit exceeded'))
          .mockRejectedValueOnce(new Error('Server error 500'))
          .mockResolvedValue(mockOutput),
      );

      const result = await provider.generateText({ prompt: 'Hello' });

      expect(result).toEqual(mockOutput);
    }, 10000);

    it('should not retry on auth errors', async () => {
      provider.setMockCall(async () => {
        throw new Error('Authentication failed: invalid api key');
      });

      await expect(
        provider.generateText({ prompt: 'Hello' }),
      ).rejects.toThrow(AppError);
    }, 5000);

    // -------------------------------------------------------------------------
    // Cost Estimation
    // -------------------------------------------------------------------------

    it('should estimate cost for known model', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cost = (provider as any).estimateCost(
        'claude-3-5-sonnet-20240620',
        100,
        50,
      );
      // prompt: (100/1M)*$3 = $0.0003, completion: (50/1M)*$15 = $0.00075
      // total = $0.00105
      expect(cost).toBeCloseTo(0.00105, 5);
    });

    it('should estimate cost for unknown model with conservative rate', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cost = (provider as any).estimateCost(
        'unknown-model',
        1000,
        500,
      );
      // (1500/1M)*$10 = $0.015
      expect(cost).toBeCloseTo(0.015, 5);
    });
  });

  // ---------------------------------------------------------------------------
  // isRetryableError
  // ---------------------------------------------------------------------------

  describe('isRetryableError', () => {
    it('should retry on rate limit', () => {
      expect(provider['isRetryableError'](new Error('Rate limit exceeded'))).toBe(true);
      expect(provider['isRetryableError'](new Error('429 Too Many Requests'))).toBe(true);
    });

    it('should retry on server errors', () => {
      expect(provider['isRetryableError'](new Error('Internal server error'))).toBe(true);
      expect(provider['isRetryableError'](new Error('Service 503 unavailable'))).toBe(true);
    });

    it('should retry on network errors', () => {
      expect(provider['isRetryableError'](new Error('ECONNREFUSED'))).toBe(true);
      expect(provider['isRetryableError'](new Error('ETIMEDOUT'))).toBe(true);
    });

    it('should not retry on auth errors', () => {
      expect(provider['isRetryableError'](new Error('Authentication failed'))).toBe(false);
      expect(provider['isRetryableError'](new Error('Unauthorized 401'))).toBe(false);
    });

    it('should not retry on content policy', () => {
      expect(provider['isRetryableError'](new Error('Content policy violation'))).toBe(false);
    });
  });
});
