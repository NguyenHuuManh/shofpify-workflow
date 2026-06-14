/**
 * Purpose:
 * Unit tests for PublishAgent.
 * Tests the publishing approval flow via ShopifyService and ProductService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublishAgent } from '@/agents/publish.agent';
import type { WorkflowContext } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';

// Mock services
vi.mock('@/services/product.service', () => ({
  productService: {
    getById: vi.fn(),
  },
}));

vi.mock('@/services/shopify', () => ({
  shopifyService: {
    getByProductId: vi.fn(),
    publish: vi.fn(),
  },
}));

describe('PublishAgent', () => {
  let mockAI: AIProvider;

  beforeEach(() => {
    mockAI = {
      providerName: 'test',
      generateText: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('should publish when product is APPROVED', async () => {
    const { productService } = await import('@/services/product.service');
    const { shopifyService } = await import('@/services/shopify');

    (productService.getById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'prod_001',
      title: 'Portable Blender',
      status: 'APPROVED',
    });

    (shopifyService.getByProductId as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'shr_001',
      shopifyProductId: 'shop_12345',
      published: false,
    });

    (shopifyService.publish as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const agent = new PublishAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Portable Blender',
    };

    const result = await agent.execute(context);

    expect(shopifyService.publish).toHaveBeenCalledWith('prod_001', 'shop_12345');
    const extended = result as WorkflowContext & { published: boolean };
    expect(extended.published).toBe(true);
  });

  it('should throw when product is not APPROVED', async () => {
    const { productService } = await import('@/services/product.service');

    (productService.getById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'prod_001',
      title: 'Portable Blender',
      status: 'DRAFT',
    });

    const agent = new PublishAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Portable Blender',
    };

    await expect(agent.execute(context)).rejects.toThrow('Status must be APPROVED');
  });

  it('should throw when no Shopify draft exists', async () => {
    const { productService } = await import('@/services/product.service');
    const { shopifyService } = await import('@/services/shopify');

    (productService.getById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'prod_001',
      title: 'Portable Blender',
      status: 'APPROVED',
    });

    (shopifyService.getByProductId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const agent = new PublishAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Portable Blender',
    };

    await expect(agent.execute(context)).rejects.toThrow('No Shopify draft found');
  });
});
