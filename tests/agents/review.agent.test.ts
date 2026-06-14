/**
 * Purpose:
 * Unit tests for ReviewAgent.
 */

import { describe, it, expect, vi } from 'vitest';
import { ReviewAgent } from '@/agents/review.agent';
import type { WorkflowContext } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';

const mockReviewOutput = {
  overallScore: 8,
  sections: {
    research: { score: 8, issues: [] },
    content: { score: 9, issues: [] },
    seo: { score: 7, issues: ['Meta title slightly over 60 chars'] },
    landingPage: { score: 8, issues: [] },
    images: { score: 7, issues: ['Missing lifestyle images'] },
  },
  summary: 'Good overall quality. Minor SEO and image improvements needed.',
  recommendations: ['Shorten meta title', 'Add more lifestyle images'],
  readyForPublishing: true,
};

describe('ReviewAgent', () => {
  it('should return review with scores', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify(mockReviewOutput),
        model: 'test',
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
      }),
    };

    const agent = new ReviewAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Portable Blender',
      research: { targetAudience: {}, competitors: {}, painPoints: {}, usp: {}, marketSummary: 'test' },
      content: { headline: 'Test', description: 'Test', benefits: {}, features: {}, faq: {} },
      seo: { metaTitle: 'Test', metaDescription: 'Test', slug: 'test', keywords: ['test'] },
      landingPage: { sections: { hero: {}, benefits: {}, features: {}, testimonials: {}, faq: {}, cta: {} } },
      imagePrompts: [],
    };

    const result = await agent.execute(context);

    const extended = result as WorkflowContext & { review: typeof mockReviewOutput };
    expect(extended.review).toBeDefined();
    expect(extended.review.overallScore).toBe(8);
    expect(extended.review.readyForPublishing).toBe(true);
  });

  it('should handle missing sections gracefully', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify(mockReviewOutput),
        model: 'test',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
    };

    const agent = new ReviewAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Test',
    };

    const result = await agent.execute(context);

    expect(result).toBeDefined();
    expect(mockAI.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('NOT GENERATED'),
      }),
    );
  });
});
