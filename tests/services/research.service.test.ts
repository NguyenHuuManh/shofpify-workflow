/**
 * Purpose:
 * Unit tests for ResearchService.
 */

import { describe, expect, it, vi } from 'vitest';
import { ResearchService } from '@/services/research.service';
import { CandidateScoringService } from '@/services/candidate-scoring.service';
import type { AIProvider } from '@/types/ai-provider.interface';

describe('ResearchService', () => {
  it('should generate, score, persist, and recommend candidates', async () => {
    const run = {
      id: 'run_001',
      productId: 'prod_001',
      workflowId: 'wf_001',
      input: {},
      summary: null,
      recommendation: null,
      providerCosts: null,
      startedAt: new Date('2026-01-01'),
      completedAt: null,
      createdAt: new Date('2026-01-01'),
    };
    const completedRun = {
      ...run,
      summary: 'Strong opportunity.',
      completedAt: new Date('2026-01-01'),
    };
    const candidate = {
      id: 'cand_001',
      researchRunId: run.id,
      productId: 'prod_001',
      name: 'Self-cleaning Portable Blender',
      positioning: 'Portable smoothie prep with easy cleanup',
      targetMarket: 'US',
      sellingAngle: 'Blend and clean anywhere',
      recommendedPrice: null,
      estimatedCOGS: null,
      estimatedShipping: null,
      estimatedGrossProfit: null,
      grossMarginPercent: null,
      breakEvenRoas: null,
      demandScore: 80,
      trendScore: 70,
      competitionScore: 60,
      marginScore: 77,
      supplierScore: 75,
      creativePotentialScore: 85,
      riskScore: 30,
      winningScore: 74,
      confidence: 'medium',
      status: 'SHORTLISTED',
      risks: [],
      metadata: {},
      createdAt: new Date('2026-01-01'),
    };

    const runRepo = {
      create: vi.fn().mockResolvedValue(run),
      updateCompleted: vi.fn().mockResolvedValue(completedRun),
    };
    const candidateRepo = {
      create: vi.fn().mockResolvedValue(candidate),
    };
    const sourceRepo = {
      create: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          id: `src_${sourceRepo.create.mock.calls.length}`,
          createdAt: new Date('2026-01-01'),
          ...input,
        }),
      ),
    };
    const researchRepo = {
      upsert: vi.fn().mockResolvedValue({ id: 'research_001' }),
    };
    const workflowRepo = {};
    const auditRepo = {
      create: vi.fn().mockResolvedValue({ id: 'audit_001' }),
    };
    const aiProvider: AIProvider = {
      providerName: 'test-ai',
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          summary: 'Strong opportunity.',
          candidates: [
            {
              name: 'Self-cleaning Portable Blender',
              positioning: 'Portable smoothie prep with easy cleanup',
              targetMarket: 'US',
              sellingAngle: 'Blend and clean anywhere',
              recommendedPrice: 100,
              estimatedCOGS: 35,
              estimatedShipping: 10,
              scores: {
                demandScore: 80,
                trendScore: 70,
                competitionScore: 60,
                supplierScore: 75,
                creativePotentialScore: 85,
                riskScore: 30,
              },
              confidence: 'medium',
              risks: [],
            },
          ],
        }),
        model: 'test',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    };

    const service = new ResearchService(
      runRepo as never,
      candidateRepo as never,
      sourceRepo as never,
      researchRepo as never,
      workflowRepo as never,
      auditRepo as never,
      new CandidateScoringService(),
      [],
      aiProvider,
    );

    const result = await service.run({
      workflowId: 'wf_001',
      productId: 'prod_001',
      productIdea: 'Portable Blender',
    });

    expect(result.researchRun.id).toBe('run_001');
    expect(result.candidates).toEqual([candidate]);
    expect(result.recommendation.bestCandidateId).toBe('cand_001');
    expect(runRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'prod_001', workflowId: 'wf_001' }),
    );
    expect(candidateRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        researchRunId: 'run_001',
        productId: 'prod_001',
        name: 'Self-cleaning Portable Blender',
        winningScore: expect.any(Number),
      }),
    );
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        researchRunId: 'run_001',
        candidateId: 'cand_001',
        type: 'AI_ESTIMATE',
      }),
    );
    expect(researchRepo.upsert).toHaveBeenCalledWith(
      'prod_001',
      expect.objectContaining({
        marketSummary: 'Strong opportunity.',
        selectedCandidateId: null,
      }),
    );
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESEARCH_RUN_COMPLETED' }),
    );
  });
});
