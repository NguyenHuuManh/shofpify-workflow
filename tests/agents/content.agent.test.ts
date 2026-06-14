/**
 * Purpose:
 * Unit tests for ContentAgent.
 */

import { describe, it, expect, vi } from 'vitest';
import { ContentAgent } from '@/agents/content.agent';
import type { WorkflowContext } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';

const mockContentOutput = {
  headline: 'Revolutionary Portable Blender for On-the-Go Nutrition',
  subHeadline: 'Blend smoothies anywhere in 30 seconds with our self-cleaning design',
  description: '<p>A powerful portable blender...</p>',
  benefits: {
    benefit1: { title: 'Portable', description: 'Take it anywhere', icon: '🎒' },
    benefit2: { title: 'Powerful', description: 'Crush ice easily', icon: '💪' },
    benefit3: { title: 'Easy Clean', description: 'Self-cleaning', icon: '✨' },
    benefit4: { title: 'Long Battery', description: '20 blends per charge', icon: '🔋' },
  },
  features: {
    feature1: { name: 'Motor', spec: '500W', benefit: 'Crushes frozen fruit' },
    feature2: { name: 'Battery', spec: '5000mAh', benefit: 'Lasts all week' },
    feature3: { name: 'Blade', spec: 'Stainless steel', benefit: 'Durable' },
    feature4: { name: 'Capacity', spec: '500ml', benefit: 'Perfect single serve' },
    feature5: { name: 'Weight', spec: '400g', benefit: 'Ultra lightweight' },
  },
  faq: {
    q1: { question: 'How do I clean it?', answer: 'Add water and blend.' },
    q2: { question: 'How long does battery last?', answer: '~20 blends.' },
    q3: { question: 'Is it dishwasher safe?', answer: 'No, hand wash only.' },
    q4: { question: 'What can I blend?', answer: 'Fruits, ice, protein.' },
    q5: { question: 'Warranty?', answer: '1 year.' },
  },
};

describe('ContentAgent', () => {
  it('should return updated context with content data', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify(mockContentOutput),
        model: 'test',
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
      }),
    };

    const agent = new ContentAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Portable Blender',
    };

    const result = await agent.execute(context);

    expect(result.content).toBeDefined();
    expect(result.content!.headline).toContain('Portable Blender');
    expect(result.content!.faq).toBeDefined();
    expect(mockAI.generateText).toHaveBeenCalledTimes(1);
  });

  it('should include research context when available', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify(mockContentOutput),
        model: 'test',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
    };

    const agent = new ContentAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Portable Blender',
      research: {
        targetAudience: { primary: 'test' },
        competitors: {},
        painPoints: {},
        usp: { primary: 'test' },
        marketSummary: 'test',
      },
    };

    const result = await agent.execute(context);

    expect(result.content).toBeDefined();
    expect(mockAI.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('RESEARCH DATA'),
      }),
    );
  });
});
