/**
 * Purpose:
 * Abstract base class for all AI providers.
 * Provides retry logic, usage tracking, and error wrapping.
 * Concrete providers only need to implement the actual API call.
 *
 * Responsibilities:
 * - Enforce AIProvider interface contract
 * - Apply exponential backoff retry on transient failures
 * - Track token usage via AIUsageLogRepository
 * - Wrap provider errors in AppError
 * - Estimate costs per model
 *
 * Dependencies:
 * - AIProvider interface
 * - AIUsageLogRepository
 * - Retry utility
 * - AppError, logger
 */

import type {
  AIProvider,
  GenerateTextInput,
  GenerateTextOutput,
} from '@/types/ai-provider.interface';
import { aiUsageLogRepository } from '@/repositories/ai-usage-log.repository';
import { logger } from '@/lib/logger';
import { AppError, ErrorCodes } from '@/lib/errors';
import { withRetry } from './retry.util';
import type { RetryConfig } from './retry.util';
import type { AIUsageLogRepository } from '@/repositories/ai-usage-log.repository';

/**
 * Cost per 1M tokens (USD) for common models.
 * Used when the provider doesn't return cost data.
 */
const MODEL_COST_PER_1M_TOKENS: Record<string, { prompt: number; completion: number }> = {
  'claude-3-5-sonnet-20240620': { prompt: 3.0, completion: 15.0 },
  'claude-3-opus-20240229': { prompt: 15.0, completion: 75.0 },
  'claude-3-sonnet-20240229': { prompt: 3.0, completion: 15.0 },
  'claude-3-haiku-20240307': { prompt: 0.25, completion: 1.25 },
  'gpt-4o': { prompt: 5.0, completion: 15.0 },
  'gpt-4-turbo': { prompt: 10.0, completion: 30.0 },
};

export interface AIProviderConfig {
  /** Retry configuration for transient failures */
  retry?: Partial<RetryConfig>;
  /** Workflow ID for usage tracking context */
  workflowId?: string;
  /** Agent run ID for usage tracking context */
  agentRunId?: string;
}

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly providerName: string;

  protected readonly retryConfig: RetryConfig;
  protected readonly workflowId?: string;
  protected readonly agentRunId?: string;
  private readonly usageRepo: AIUsageLogRepository;

  constructor(config: AIProviderConfig = {}) {
    this.retryConfig = {
      baseDelayMs: config.retry?.baseDelayMs ?? 5000,
      maxDelayMs: config.retry?.maxDelayMs ?? 45000,
      backoffMultiplier: config.retry?.backoffMultiplier ?? 3,
      maxRetries: config.retry?.maxRetries ?? 3,
      retryIf: config.retry?.retryIf ?? this.isRetryableError.bind(this),
    };
    this.workflowId = config.workflowId;
    this.agentRunId = config.agentRunId;
    this.usageRepo = aiUsageLogRepository;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const model = input.model ?? this.getDefaultModel();

    logger.info(
      { provider: this.providerName, model, workflowId: this.workflowId },
      'AI text generation started',
    );

    try {
      const output = await withRetry(
        () => this.callAPI(input),
        this.retryConfig,
        `${this.providerName}.generateText`,
      );

      // Track usage
      await this.trackUsage(model, output);

      logger.info(
        {
          provider: this.providerName,
          model,
          tokens: output.usage.totalTokens,
          workflowId: this.workflowId,
        },
        'AI text generation completed',
      );

      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown AI provider error';

      logger.error(
        {
          provider: this.providerName,
          model,
          error: message,
          workflowId: this.workflowId,
        },
        'AI text generation failed',
      );

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError({
        code: ErrorCodes.AI_PROVIDER_ERROR,
        message: `${this.providerName} API error: ${message}`,
        statusCode: 502,
        details: { provider: this.providerName, model },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Abstract: Subclasses must implement
  // ---------------------------------------------------------------------------

  /**
   * Execute the actual API call to the AI provider.
   * Subclasses implement this with provider-specific SDK calls.
   */
  protected abstract callAPI(input: GenerateTextInput): Promise<GenerateTextOutput>;

  /**
   * Return the default model for this provider.
   */
  protected abstract getDefaultModel(): string;

  // ---------------------------------------------------------------------------
  // Usage Tracking
  // ---------------------------------------------------------------------------

  /**
   * Estimate cost based on model pricing and token counts.
   */
  protected estimateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = MODEL_COST_PER_1M_TOKENS[model];
    if (!pricing) {
      // Unknown model: use conservative estimate
      return ((promptTokens + completionTokens) / 1_000_000) * 10;
    }

    const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
    const completionCost = (completionTokens / 1_000_000) * pricing.completion;
    return promptCost + completionCost;
  }

  /**
   * Persist usage data for monitoring and cost tracking.
   */
  protected async trackUsage(
    model: string,
    output: GenerateTextOutput,
  ): Promise<void> {
    try {
      await this.usageRepo.create({
        provider: this.providerName,
        model,
        workflowId: this.workflowId,
        agentRunId: this.agentRunId,
        promptTokens: output.usage.promptTokens,
        completionTokens: output.usage.completionTokens,
        totalTokens: output.usage.totalTokens,
        estimatedCost: this.estimateCost(
          model,
          output.usage.promptTokens,
          output.usage.completionTokens,
        ),
      });
    } catch (error) {
      // Don't fail the operation if usage tracking fails
      logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown', provider: this.providerName },
        'Failed to track AI usage',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Retry Logic
  // ---------------------------------------------------------------------------

  /**
   * Determine if an error is retryable.
   * Retry on rate limits, server errors, and network issues.
   * Do not retry on authentication or content policy violations.
   */
  protected isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Always retry these
    const retryable = [
      'rate_limit',
      'rate limit',
      'too many requests',
      '429',
      'server error',
      'internal server error',
      '500',
      '502',
      '503',
      '504',
      'timeout',
      'network',
      'econnrefused',
      'econnreset',
      'etimedout',
      'overloaded',
      'temporarily unavailable',
    ];

    // Never retry these
    const nonRetryable = [
      'authentication',
      'unauthorized',
      'invalid api key',
      '401',
      '403',
      'content policy',
      'safety',
      'invalid_request_error',
    ];

    if (nonRetryable.some((pattern) => message.includes(pattern))) {
      return false;
    }

    return retryable.some((pattern) => message.includes(pattern));
  }
}
