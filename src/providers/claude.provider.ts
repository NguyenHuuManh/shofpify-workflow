/**
 * Purpose:
 * Anthropic Claude AI provider implementation.
 * Integrates with the Anthropic API via @anthropic-ai/sdk.
 *
 * Responsibilities:
 * - Execute text generation via Anthropic Messages API
 * - Map Claude responses to the standard GenerateTextOutput format
 * - Provide default model configuration
 *
 * Dependencies:
 * - @anthropic-ai/sdk
 * - @/lib/env (for API key)
 * - BaseAIProvider
 * - AIProvider interface
 */

import { BaseAIProvider } from './base-ai-provider';
import type { GenerateTextInput, GenerateTextOutput } from '@/types/ai-provider.interface';
import type { AIProviderConfig } from './base-ai-provider';
import { loadEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

// Lazy-loaded Anthropic client
let _anthropicClient: unknown = null;

function getAnthropicClient(): unknown {
  if (!_anthropicClient) {
    const env = loadEnv();
    // Dynamic import to avoid issues if the SDK isn't installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: Anthropic } = require('@anthropic-ai/sdk') as {
      default: new (opts: { apiKey: string }) => {
        messages: {
          create: (params: Record<string, unknown>) => Promise<{
            id: string;
            model: string;
            content: Array<{ type: string; text: string }>;
            usage: { input_tokens: number; output_tokens: number };
            stop_reason: string;
          }>;
        };
      };
    };

    _anthropicClient = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });

    logger.info('Anthropic client initialized');
  }
  return _anthropicClient;
}

interface AnthropicResponse {
  id: string;
  model: string;
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string;
}

interface AnthropicClient {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      temperature: number;
      system?: string;
      messages: Array<{ role: 'user'; content: string }>;
    }) => Promise<AnthropicResponse>;
  };
}

export class ClaudeProvider extends BaseAIProvider {
  readonly providerName = 'claude';

  constructor(config: AIProviderConfig = {}) {
    super(config);
  }

  protected getDefaultModel(): string {
    const env = loadEnv();
    return env.ANTHROPIC_MODEL;
  }

  protected async callAPI(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const client = getAnthropicClient() as AnthropicClient;
    const model = input.model ?? this.getDefaultModel();

    const messages: Array<{ role: 'user'; content: string }> = [
      { role: 'user', content: input.prompt },
    ];

    const params: {
      model: string;
      max_tokens: number;
      temperature: number;
      system?: string;
      messages: typeof messages;
    } = {
      model,
      max_tokens: input.maxTokens ?? 4096,
      temperature: input.temperature ?? 0.7,
      messages,
    };

    if (input.systemPrompt) {
      params.system = input.systemPrompt;
    }

    const response = await client.messages.create(params);

    // Extract text content
    const textBlocks = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text);

    const text = textBlocks.join('\n');

    return {
      text,
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}
