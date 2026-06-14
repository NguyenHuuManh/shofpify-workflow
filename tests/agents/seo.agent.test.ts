/**
 * Purpose:
 * Unit tests for SEOAgent.
 */

import { describe, it, expect, vi } from 'vitest';
import { SEOAgent } from '@/agents/seo.agent';
import type { WorkflowContext } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';

const mockSEOOutput = {
  metaTitle: 'Portable Blender Pro | Self-Cleaning USB-C Rechargeable Blender',
  metaDescription: 'Blend anywhere with the Portable Blender Pro. Self-cleaning, USB-C rechargeable, 500W motor. Perfect for smoothies on-the-go. Shop now!',
  slug: 'portable-blender-pro',
  keywords: ['portable blender', 'USB-C blender', 'self-cleaning blender', 'travel blender', 'rechargeable blender', 'mini blender', 'smoothie blender portable', 'best portable blender 2026'],
};

describe('SEOAgent', () => {
  it('should return updated context with SEO data', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify(mockSEOOutput),
        model: 'test',
        usage: { promptTokens: 100, completionTokens: 80, totalTokens: 180 },
      }),
    };

    const agent = new SEOAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Portable Blender',
    };

    const result = await agent.execute(context);

    expect(result.seo).toBeDefined();
    expect(result.seo!.metaTitle).toContain('Portable Blender');
    expect(result.seo!.slug).toBe('portable-blender-pro');
    expect(result.seo!.keywords).toHaveLength(8);
  });

  it('should throw on empty keywords array', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify({ ...mockSEOOutput, keywords: [] }),
        model: 'test',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
    };

    const agent = new SEOAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Test',
    };

    await expect(agent.execute(context)).rejects.toThrow('keywords must be a non-empty array');
  });
});
