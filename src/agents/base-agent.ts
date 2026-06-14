/**
 * Purpose:
 * Abstract base class for all workflow agents.
 * Provides AI provider access, logging, and error handling.
 * Agents must never access Prisma, Shopify, or AI SDKs directly.
 *
 * Responsibilities:
 * - Provide AI provider via factory (interface-driven)
 * - Structured logging with agent context
 * - Error wrapping in AppError
 * - JSON response parsing from AI output
 *
 * Dependencies:
 * - AIProvider (via providers/)
 * - logger
 * - AppError
 */

import type { AIProvider, GenerateTextInput } from '@/types/ai-provider.interface';
import type { WorkflowContext } from '@/types';
import { createDefaultProvider } from '@/providers/provider.factory';
import { logger } from '@/lib/logger';
import { AppError, ErrorCodes } from '@/lib/errors';

export abstract class BaseAgent {
  abstract readonly name: string;

  protected ai: AIProvider;

  constructor(aiProvider?: AIProvider) {
    this.ai = aiProvider ?? createDefaultProvider();
  }

  /**
   * Execute the agent's task on the workflow context.
   * Each agent implements this with specific logic.
   */
  abstract execute(context: WorkflowContext): Promise<WorkflowContext>;

  /**
   * Generate text using the AI provider with agent-specific system prompt.
   */
  protected async generate(
    prompt: string,
    systemPrompt: string,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    logger.debug({ agent: this.name }, 'Agent generating AI response');

    const input: GenerateTextInput = {
      prompt,
      systemPrompt,
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 4096,
    };

    const output = await this.ai.generateText(input);
    return output.text;
  }

  /**
   * Parse JSON from AI response text.
   * Handles markdown code blocks and plain JSON.
   */
  protected parseJSON<T>(text: string): T {
    // Remove markdown code block markers if present
    let cleaned = text.trim();

    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }

    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }

    cleaned = cleaned.trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch (error) {
      logger.error({ agent: this.name, text: cleaned.substring(0, 200) }, 'Failed to parse AI JSON response');
      throw new AppError({
        code: ErrorCodes.AI_PROVIDER_ERROR,
        message: `${this.name} returned invalid JSON response`,
        statusCode: 502,
        details: { rawText: cleaned.substring(0, 500) },
      });
    }
  }

  /**
   * Extract product name from the product idea for prompts.
   */
  protected extractProductName(context: WorkflowContext): string {
    return context.productIdea || 'the product';
  }
}
