/**
 * Purpose:
 * Central barrel export for the AI Provider layer.
 * Business logic imports from here, never from individual providers.
 *
 * Dependencies:
 * - All provider modules
 */

// Interfaces
export type {
  AIProvider,
  GenerateTextInput,
  GenerateTextOutput,
} from '@/types/ai-provider.interface';

// Base
export { BaseAIProvider } from './base-ai-provider';
export type { AIProviderConfig } from './base-ai-provider';

// Implementations
export { ClaudeProvider } from './claude.provider';

// Factory
export {
  createProvider,
  createDefaultProvider,
  registerProvider,
  hasProvider,
  getRegisteredProviders,
} from './provider.factory';
export type { ProviderName } from './provider.factory';

// Retry
export { withRetry, calculateBackoff, DEFAULT_RETRY_CONFIG } from './retry.util';
export type { RetryConfig } from './retry.util';
