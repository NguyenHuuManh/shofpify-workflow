/**
 * Purpose:
 * DeepSeek AI provider implementation.
 * Uses the DeepSeek API (OpenAI-compatible) via native fetch.
 * No SDK dependency required — the API is fully OpenAI-compatible.
 *
 * Responsibilities:
 * - Execute text generation via DeepSeek Chat Completions API
 * - Map DeepSeek responses to the standard GenerateTextOutput format
 * - Provide default model configuration (deepseek-chat)
 *
 * Dependencies:
 * - @/lib/env (for API key)
 * - BaseAIProvider
 * - AIProvider interface
 */

import { BaseAIProvider } from './base-ai-provider';
import type { GenerateTextInput, GenerateTextOutput } from '@/types/ai-provider.interface';
import type { AIProviderConfig } from './base-ai-provider';
import { loadEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { AppError, ErrorCodes } from '@/lib/errors';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-chat';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DeepSeekProvider extends BaseAIProvider {
  readonly providerName = 'deepseek';

  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(config?: AIProviderConfig) {
    super(config);

    const env = loadEnv();
    const apiKey = env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      throw new AppError({
        code: ErrorCodes.CONFIGURATION_ERROR,
        message: 'DEEPSEEK_API_KEY is not set',
        statusCode: 500,
      });
    }

    this.apiKey = apiKey;
    this.defaultModel = env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;

    logger.info({ model: this.defaultModel }, 'DeepSeek provider initialized');
  }

  async callAPI(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const model = input.model ?? this.defaultModel;

    const messages: DeepSeekMessage[] = [];

    if (input.systemPrompt) {
      messages.push({ role: 'system', content: input.systemPrompt });
    }

    messages.push({ role: 'user', content: input.prompt });

    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        { status: response.status, body: errorBody },
        'DeepSeek API error',
      );
      throw new AppError({
        code: ErrorCodes.AI_PROVIDER_ERROR,
        message: `DeepSeek API returned ${response.status}: ${errorBody}`,
        statusCode: 502,
      });
    }

    const data = (await response.json()) as DeepSeekResponse;

    const content = data.choices[0]?.message?.content ?? '';

    logger.debug(
      {
        model: data.model,
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      },
      'DeepSeek generation completed',
    );

    return {
      text: content,
      model: data.model,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  protected getDefaultModel(): string {
    return this.defaultModel;
  }
}
