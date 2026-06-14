/**
 * Purpose:
 * Unit tests for LandingAgent.
 */

import { describe, it, expect, vi } from 'vitest';
import { LandingAgent } from '@/agents/landing.agent';
import type { WorkflowContext } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';

const mockLandingOutput = {
  sections: {
    hero: { headline: 'Hero', subheadline: 'Sub', ctaText: 'Buy', ctaLink: '#', backgroundStyle: 'dark', layout: 'left' },
    benefits: { title: 'Benefits', subtitle: 'Sub', items: [], layout: 'grid' },
    features: { title: 'Features', subtitle: 'Sub', items: [], layout: 'rows' },
    testimonials: { title: 'Reviews', subtitle: 'Sub', items: [], layout: 'cards' },
    faq: { title: 'FAQ', subtitle: 'Sub', items: [], layout: 'accordion' },
    cta: { headline: 'CTA', subheadline: 'Sub', buttonText: 'Buy', buttonLink: '#', urgencyText: 'Limited', layout: 'banner' },
  },
};

describe('LandingAgent', () => {
  it('should return updated context with landing page data', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify(mockLandingOutput),
        model: 'test',
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
      }),
    };

    const agent = new LandingAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Portable Blender',
    };

    const result = await agent.execute(context);

    expect(result.landingPage).toBeDefined();
    expect(result.landingPage!.sections).toBeDefined();
    const sections = result.landingPage!.sections as Record<string, unknown>;
    expect(sections.hero).toBeDefined();
    expect(sections.cta).toBeDefined();
  });

  it('should throw on missing required sections', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify({ sections: { hero: {} } }),
        model: 'test',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
    };

    const agent = new LandingAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Test',
    };

    await expect(agent.execute(context)).rejects.toThrow('missing required section');
  });
});
