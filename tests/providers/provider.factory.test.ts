/**
 * Purpose:
 * Unit tests for ProviderFactory.
 * Tests provider registration, creation, and defaults.
 *
 * Dependencies:
 * - vitest
 * - provider.factory
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createProvider,
  createDefaultProvider,
  registerProvider,
  hasProvider,
  getRegisteredProviders,
} from '@/providers/provider.factory';
import { ClaudeProvider } from '@/providers/claude.provider';
import { BaseAIProvider } from '@/providers/base-ai-provider';
import type { GenerateTextInput, GenerateTextOutput } from '@/types/ai-provider.interface';

/**
 * Mock provider for testing dynamic registration.
 */
class MockProvider extends BaseAIProvider {
  readonly providerName = 'mock';

  protected getDefaultModel(): string {
    return 'mock-model';
  }

  protected async callAPI(_input: GenerateTextInput): Promise<GenerateTextOutput> {
    return {
      text: 'Mock response',
      model: 'mock-model',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}

describe('ProviderFactory', () => {
  beforeEach(() => {
    // Register mock provider for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerProvider('deepseek', MockProvider as any);
  });

  describe('createProvider', () => {
    it('should create Claude provider', () => {
      const provider = createProvider('claude');

      expect(provider).toBeInstanceOf(ClaudeProvider);
      expect(provider.providerName).toBe('claude');
    });

    it('should create a dynamically registered provider', () => {
      const provider = createProvider('deepseek');

      expect(provider).toBeInstanceOf(MockProvider);
      expect(provider.providerName).toBe('mock');
    });

    it('should throw for unregistered provider', () => {
      expect(() => createProvider('unknown' as never)).toThrow(
        "AI provider 'unknown' is not registered",
      );
    });

    it('should pass config to provider', () => {
      const provider = createProvider('claude', {
        workflowId: 'wf_test',
      });

      expect(provider.providerName).toBe('claude');
    });
  });

  describe('createDefaultProvider', () => {
    it('should create Claude as default', () => {
      const provider = createDefaultProvider();

      expect(provider.providerName).toBe('claude');
      expect(provider).toBeInstanceOf(ClaudeProvider);
    });
  });

  describe('hasProvider', () => {
    it('should return true for registered providers', () => {
      expect(hasProvider('claude')).toBe(true);
      expect(hasProvider('deepseek')).toBe(true);
    });

    it('should return false for unregistered providers', () => {
      expect(hasProvider('openai')).toBe(false);
      expect(hasProvider('unknown' as never)).toBe(false);
    });
  });

  describe('getRegisteredProviders', () => {
    it('should return list of all registered providers', () => {
      const providers = getRegisteredProviders();

      expect(providers).toContain('claude');
      expect(providers).toContain('deepseek');
    });
  });
});
