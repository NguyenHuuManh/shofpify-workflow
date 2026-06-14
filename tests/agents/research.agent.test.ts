/**
 * Purpose:
 * Unit tests for ResearchAgent.
 *
 * Dependencies:
 * - vitest
 * - ResearchAgent
 */

import { describe, it, expect, vi } from 'vitest';
import { ResearchAgent } from '@/agents/research.agent';
import type { WorkflowContext } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';

const mockResearchOutput = {
  targetAudience: {
    primaryPersona: 'Health-conscious millennials',
    demographics: { age: '25-40', gender: '60% female', income: '$50K-$100K', location: 'Urban' },
    interests: ['fitness', 'smoothies'],
    behaviorPatterns: ['online shopping'],
  },
  competitors: {
    direct: [{ name: 'BlendJet', strengths: ['portable'], weaknesses: ['small'], priceRange: '$30-$50', marketShare: '25%' }],
    indirect: [{ name: 'NutriBullet', description: 'Countertop blender' }],
  },
  painPoints: {
    primary: ['Cleaning difficulty'],
    secondary: ['Battery life'],
    severity: { 'Cleaning difficulty': 'high' },
  },
  usp: {
    primary: 'Self-cleaning portable blender',
    supporting: ['USB-C charging'],
    differentiation: 'Unique self-cleaning mechanism',
  },
  marketSummary: 'Strong market opportunity.',
};

describe('ResearchAgent', () => {
  it('should return updated context with research data', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify(mockResearchOutput),
        model: 'test',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
    };

    const agent = new ResearchAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Portable Blender',
    };

    const result = await agent.execute(context);

    expect(result.research).toBeDefined();
    expect(result.research!.marketSummary).toBe('Strong market opportunity.');
    expect(result.research!.usp.primary).toBe('Self-cleaning portable blender');
    expect(mockAI.generateText).toHaveBeenCalledTimes(1);
    expect(mockAI.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Portable Blender'),
      }),
    );
  });

  it('should pass through existing context fields', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify(mockResearchOutput),
        model: 'test',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
    };

    const agent = new ResearchAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_002',
      productId: 'prod_002',
      productIdea: 'Smart Water Bottle',
    };

    const result = await agent.execute(context);

    expect(result.workflowId).toBe('wf_002');
    expect(result.productId).toBe('prod_002');
    expect(result.productIdea).toBe('Smart Water Bottle');
  });

  it('should throw on invalid AI response', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn().mockResolvedValue({
        text: 'not valid json',
        model: 'test',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
    };

    const agent = new ResearchAgent(mockAI);
    const context: WorkflowContext = {
      workflowId: 'wf_003',
      productId: 'prod_003',
      productIdea: 'Test',
    };

    await expect(agent.execute(context)).rejects.toThrow();
  });
});
