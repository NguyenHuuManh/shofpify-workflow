/**
 * Purpose:
 * Unit tests for ImageAgent.
 */

import { describe, it, expect, vi } from 'vitest';
import { ImageAgent } from '@/agents/image.agent';
import type { WorkflowContext } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';

const mockImageOutput = {
  prompts: [
    { assetType: 'HERO_IMAGE', prompt: 'Hero image prompt...', description: 'Main banner' },
    { assetType: 'PRODUCT_IMAGE', prompt: 'Product shot...', description: 'Main product' },
    { assetType: 'PRODUCT_IMAGE', prompt: 'Lifestyle shot...', description: 'In use' },
    { assetType: 'PRODUCT_IMAGE', prompt: 'Close-up shot...', description: 'Detail' },
    { assetType: 'THUMBNAIL', prompt: 'Thumbnail...', description: 'Catalog' },
    { assetType: 'LANDING_IMAGE', prompt: 'Lifestyle...', description: 'Benefits section' },
  ],
};

describe('ImageAgent', () => {
  it('should return updated context with image prompts', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify(mockImageOutput),
        model: 'test',
        usage: { promptTokens: 100, completionTokens: 80, totalTokens: 180 },
      }),
    };

    const agent = new ImageAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Portable Blender',
    };

    const result = await agent.execute(context);

    expect(result.imagePrompts).toBeDefined();
    expect(result.imagePrompts!).toHaveLength(6);
    expect(result.imagePrompts![0]!.assetType).toBe('HERO_IMAGE');
    expect(result.imagePrompts![0]!.prompt).toContain('Hero');
  });

  it('should throw on missing prompts array', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify({ notPrompts: [] }),
        model: 'test',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
    };

    const agent = new ImageAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Test',
    };

    await expect(agent.execute(context)).rejects.toThrow('missing prompts array');
  });
});
