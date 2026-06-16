/**
 * Purpose:
 * Unit tests for WorkflowEngine.
 */

import { describe, it, expect, vi } from 'vitest';
import { WorkflowEngine } from '@/workflows/workflow-engine';
import { WorkflowState } from '@/workflows/workflow-state';
import type { AIProvider } from '@/types/ai-provider.interface';

// Mock WorkflowService
vi.mock('@/services/workflow.service', () => ({
  workflowService: {
    completeCurrentStep: vi.fn().mockResolvedValue({}),
    failCurrentStep: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/repositories/product-content.repository', () => ({
  productContentRepository: {
    upsert: vi.fn().mockResolvedValue({ id: 'content_001' }),
  },
}));

// Mock all agents
vi.mock('@/agents/research.agent', () => ({
  ResearchAgent: vi.fn().mockImplementation(() => ({
    name: 'ResearchAgent',
    execute: vi.fn().mockImplementation((ctx: Record<string, unknown>) => ({
      ...ctx,
      research: { marketSummary: 'test', targetAudience: {}, competitors: {}, painPoints: {}, usp: {} },
    })),
  })),
}));

vi.mock('@/agents/content.agent', () => ({
  ContentAgent: vi.fn().mockImplementation(() => ({
    name: 'ContentAgent',
    execute: vi.fn().mockImplementation((ctx: Record<string, unknown>) => ({
      ...ctx,
      content: { headline: 'Test', description: 'Test', benefits: {}, features: {}, faq: {} },
    })),
  })),
}));

vi.mock('@/agents/seo.agent', () => ({
  SEOAgent: vi.fn().mockImplementation(() => ({
    name: 'SEOAgent',
    execute: vi.fn().mockImplementation((ctx: Record<string, unknown>) => ({
      ...ctx,
      seo: { metaTitle: 'Test', metaDescription: 'Test', slug: 'test', keywords: ['test'] },
    })),
  })),
}));

vi.mock('@/agents/landing.agent', () => ({
  LandingAgent: vi.fn().mockImplementation(() => ({
    name: 'LandingAgent',
    execute: vi.fn().mockImplementation((ctx: Record<string, unknown>) => ({
      ...ctx,
      landingPage: { sections: { hero: {} } },
    })),
  })),
}));

vi.mock('@/agents/image.agent', () => ({
  ImageAgent: vi.fn().mockImplementation(() => ({
    name: 'ImageAgent',
    execute: vi.fn().mockImplementation((ctx: Record<string, unknown>) => ({
      ...ctx,
      imagePrompts: [{ assetType: 'HERO_IMAGE', prompt: 'test', description: 'test' }],
    })),
  })),
}));

vi.mock('@/agents/shopify.agent', () => ({
  ShopifyAgent: vi.fn().mockImplementation(() => ({
    name: 'ShopifyAgent',
    execute: vi.fn().mockImplementation((ctx: Record<string, unknown>) => ({
      ...ctx,
      shopifyProductData: {},
    })),
  })),
}));

vi.mock('@/agents/review.agent', () => ({
  ReviewAgent: vi.fn().mockImplementation(() => ({
    name: 'ReviewAgent',
    execute: vi.fn().mockImplementation((ctx: Record<string, unknown>) => ({
      ...ctx,
      review: { overallScore: 9, readyForPublishing: true },
    })),
  })),
}));

vi.mock('@/agents/publish.agent', () => ({
  PublishAgent: vi.fn().mockImplementation(() => ({
    name: 'PublishAgent',
    execute: vi.fn().mockImplementation((ctx: Record<string, unknown>) => ({
      ...ctx,
      published: true,
    })),
  })),
}));

describe('WorkflowEngine', () => {
  const mockAI: AIProvider = {
    providerName: 'test',
    generateText: vi.fn(),
  };

  describe('constructor', () => {
    it('should create with default config', () => {
      const engine = new WorkflowEngine();
      expect(engine).toBeDefined();
    });

    it('should accept custom AI provider', () => {
      const engine = new WorkflowEngine({ aiProvider: mockAI });
      expect(engine).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute full workflow', async () => {
      const engine = new WorkflowEngine({ aiProvider: mockAI, synchronous: true });
      const result = await engine.execute('wf_001', 'prod_001', 'Portable Blender');

      expect(result).toBeDefined();
      expect(result.context).toBeDefined();
      expect(result.context.workflowId).toBe('wf_001');
    }, 15000);
  });

  describe('resume', () => {
    it('should throw when resuming from terminal state', async () => {
      const engine = new WorkflowEngine({ aiProvider: mockAI });

      await expect(
        engine.resume('wf_001', 'prod_001', 'Test', WorkflowState.PUBLISHED),
      ).rejects.toThrow('terminal state');
    });
  });
});
