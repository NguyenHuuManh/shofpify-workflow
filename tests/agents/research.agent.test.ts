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
import type { ResearchService } from '@/services/research.service';
import type { ProductCandidate, ResearchRun } from '@prisma/client';

const mockResearchRun = {
  id: 'run_001',
  productId: 'prod_001',
  workflowId: 'wf_001',
  input: {},
  summary: 'Strong market opportunity.',
  recommendation: null,
  providerCosts: null,
  startedAt: new Date('2026-01-01'),
  completedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
} as ResearchRun;

const mockCandidate = {
  id: 'cand_001',
  researchRunId: 'run_001',
  researchProjectId: null,
  productId: 'prod_001',
  name: 'Self-cleaning Portable Blender',
  positioning: 'Portable smoothie prep with less cleanup friction',
  targetMarket: 'US',
  sellingAngle: 'Clean anywhere after blending',
  recommendedPrice: null,
  estimatedCOGS: null,
  estimatedShipping: null,
  estimatedGrossProfit: null,
  grossMarginPercent: null,
  breakEvenRoas: null,
  demandScore: 82,
  trendScore: 70,
  competitionScore: 60,
  marginScore: 75,
  supplierScore: 68,
  creativePotentialScore: 85,
  riskScore: 32,
  winningScore: 76,
  confidence: 'medium',
  status: 'SHORTLISTED',
  risks: [],
  metadata: {},
  createdAt: new Date('2026-01-01'),
} as ProductCandidate;

describe('ResearchAgent', () => {
  it('should run research through ResearchService and return workflow context', async () => {
    const mockAI: AIProvider = {
      providerName: 'test',
      generateText: vi.fn(),
    };
    const mockService = {
      run: vi.fn().mockResolvedValue({
        researchRun: mockResearchRun,
        candidates: [mockCandidate],
        sources: [],
        summary: 'Strong market opportunity.',
        recommendation: {
          bestCandidateId: 'cand_001',
          reason: 'Best weighted score.',
        },
      }),
    } as unknown as ResearchService;

    const agent = new ResearchAgent(mockAI, mockService);
    const context: WorkflowContext = {
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Portable Blender',
    };

    const result = await agent.execute(context);

    expect(result.researchRunId).toBe('run_001');
    expect(result.productCandidates).toEqual([mockCandidate]);
    expect(result.research?.marketSummary).toBe('Strong market opportunity.');
    expect(mockService.run).toHaveBeenCalledWith(
      {
        workflowId: 'wf_001',
        productId: 'prod_001',
        productIdea: 'Portable Blender',
      },
      mockAI,
    );
    expect(mockAI.generateText).not.toHaveBeenCalled();
  });

  it('should pass through existing context fields', async () => {
    const mockService = {
      run: vi.fn().mockResolvedValue({
        researchRun: { ...mockResearchRun, id: 'run_002' },
        candidates: [],
        sources: [],
        summary: 'Market summary.',
        recommendation: {
          reason: 'No strong candidate.',
        },
      }),
    } as unknown as ResearchService;

    const agent = new ResearchAgent(undefined, mockService);
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

  it('should surface ResearchService failures', async () => {
    const mockService = {
      run: vi.fn().mockRejectedValue(new Error('research failed')),
    } as unknown as ResearchService;

    const agent = new ResearchAgent(undefined, mockService);
    const context: WorkflowContext = {
      workflowId: 'wf_003',
      productId: 'prod_003',
      productIdea: 'Test',
    };

    await expect(agent.execute(context)).rejects.toThrow('research failed');
  });
});
