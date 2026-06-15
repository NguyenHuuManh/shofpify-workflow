/**
 * Purpose:
 * AI Provider factory and registry.
 * Creates provider instances by name. Business logic depends on this,
 * never on concrete provider classes.
 *
 * Responsibilities:
 * - Register available AI providers
 * - Create provider instances by name
 * - Support lazy provider registration (future providers)
 *
 * Dependencies:
 * - AIProvider interface
 * - ClaudeProvider
 * - @/lib/env
 */

import type { AIProvider } from '@/types/ai-provider.interface';
import { ClaudeProvider } from './claude.provider';
import { DeepSeekProvider } from './deepseek.provider';
import type { AIProviderConfig } from './base-ai-provider';
import { logger } from '@/lib/logger';
import { loadEnv } from '@/lib/env';

export type ProviderName = 'claude' | 'deepseek' | 'openai';

/** Provider constructor type */
type ProviderConstructor = new (config?: AIProviderConfig) => AIProvider;

/** Registry of all available AI providers */
const providerRegistry = new Map<ProviderName, ProviderConstructor>();

// Register providers
providerRegistry.set('claude', ClaudeProvider);
providerRegistry.set('deepseek', DeepSeekProvider);

/**
 * Register a new provider implementation.
 * Use this to add OpenAI, DeepSeek, or custom providers.
 */
export function registerProvider(name: ProviderName, provider: ProviderConstructor): void {
  providerRegistry.set(name, provider);
  logger.info({ provider: name }, 'AI provider registered');
}

/**
 * Check if a provider is registered.
 */
export function hasProvider(name: ProviderName): boolean {
  return providerRegistry.has(name);
}

/**
 * Get list of all registered provider names.
 */
export function getRegisteredProviders(): ProviderName[] {
  return Array.from(providerRegistry.keys());
}

/**
 * Create an AI provider instance by name.
 * This is the primary way to obtain a provider — never instantiate directly.
 *
 * @throws AppError if the provider is not registered
 */
export function createProvider(
  name: ProviderName,
  config?: AIProviderConfig,
): AIProvider {
  const ProviderClass = providerRegistry.get(name);

  if (!ProviderClass) {
    throw new Error(
      `AI provider '${name}' is not registered. Available: ${getRegisteredProviders().join(', ')}`,
    );
  }

  const provider = new ProviderClass(config);
  logger.debug({ provider: name, workflowId: config?.workflowId }, 'AI provider created');
  return provider;
}

/**
 * Create the default provider based on available API keys.
 * Priority: Claude > DeepSeek > error
 */
export function createDefaultProvider(config?: AIProviderConfig): AIProvider {
  const env = loadEnv();

  // Check for real Anthropic key (skip placeholder/dummy values)
  const hasAnthropic = env.ANTHROPIC_API_KEY
    && env.ANTHROPIC_API_KEY.length > 20
    && !env.ANTHROPIC_API_KEY.startsWith('placeholder');

  if (hasAnthropic) {
    return createProvider('claude', config);
  }

  if (env.DEEPSEEK_API_KEY) {
    logger.info('No valid Anthropic key found — using DeepSeek');
    return createProvider('deepseek', config);
  }

  throw new Error(
    'No AI provider configured. Set ANTHROPIC_API_KEY or DEEPSEEK_API_KEY in .env',
  );
}
