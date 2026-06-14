/**
 * Purpose:
 * Unit tests for ShopifyAgent.
 * Tests Shopify draft creation via ShopifyService.
 */

import { describe, it, expect, vi } from 'vitest';
import { ShopifyAgent } from '@/agents/shopify.agent';
import type { WorkflowContext } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';

// Mock the ShopifyService
vi.mock('@/services/shopify', () => ({
  shopifyService: {
    createDraft: vi.fn().mockResolvedValue({ id: 'shr_001', published: false }),
    getByProductId: vi.fn(),
    publish: vi.fn(),
  },
}));

describe('ShopifyAgent', () => {
  it('should create Shopify draft and return context', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn(),
    };

    const agent = new ShopifyAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Portable Blender',
      content: {
        headline: 'Portable Blender Pro',
        description: '<p>A great blender</p>',
        benefits: {},
        features: {},
        faq: {},
      },
      seo: {
        metaTitle: 'Portable Blender Pro',
        metaDescription: 'Best portable blender',
        slug: 'portable-blender-pro',
        keywords: ['portable', 'blender'],
      },
    };

    const { shopifyService } = await import('@/services/shopify');
    const result = await agent.execute(context);

    expect(shopifyService.createDraft).toHaveBeenCalledWith(
      'prod_001',
      expect.any(String),
    );
    expect(result).toHaveProperty('shopifyProductData');
  });

  it('should throw when content is missing', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn(),
    };

    const agent = new ShopifyAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Test',
    };

    await expect(agent.execute(context)).rejects.toThrow('content data is required');
  });

  it('should throw when SEO is missing', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn(),
    };

    const agent = new ShopifyAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Test',
      content: {
        headline: 'Test',
        description: 'Test',
        benefits: {},
        features: {},
        faq: {},
      },
    };

    await expect(agent.execute(context)).rejects.toThrow('SEO data is required');
  });
});
