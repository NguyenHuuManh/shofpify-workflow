/**
 * Purpose:
 * Unit tests for ResearchService.
 */

import { describe, expect, it, vi } from 'vitest';
import { ResearchService } from '@/services/research.service';
import { CandidateScoringService } from '@/services/candidate-scoring.service';
import type { AIProvider } from '@/types/ai-provider.interface';

describe('ResearchService', () => {
  it('should create, score, persist, and recommend provider-backed candidates', async () => {
    const run = {
      id: 'run_001',
      researchProjectId: null,
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
      summary: 'Provider-backed opportunity.',
      completedAt: new Date('2026-01-01'),
    };
    const candidate = {
      id: 'cand_001',
      researchRunId: run.id,
      researchProjectId: null,
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
    const projectRepo = {};
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
    const providerSource = {
      type: 'MARKETPLACE',
      provider: 'SerpAPI Google Shopping',
      url: 'https://example.com/blender',
      externalId: 'shopping_001',
      title: 'Self-cleaning Portable Blender',
      extractedSignal: 'Self-cleaning Portable Blender marketplace listing, price 100, rating 4.8, 1200 reviews',
      rawData: {
        metrics: {
          price: 100,
          rating: 4.8,
          reviewCount: 1200,
        },
      },
      confidence: 0.72,
      capturedAt: new Date('2026-01-01'),
    };
    const researchProvider = {
      name: 'MarketplaceResearchProvider',
      providerType: 'marketplace' as const,
      collect: vi.fn().mockResolvedValue([providerSource]),
    };
    const aiProvider: AIProvider = {
      providerName: 'test-ai',
      generateText: vi.fn(),
    };

    const service = new ResearchService(
      runRepo as never,
      projectRepo as never,
      candidateRepo as never,
      sourceRepo as never,
      researchRepo as never,
      workflowRepo as never,
      auditRepo as never,
      new CandidateScoringService(),
      [researchProvider],
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
    expect(aiProvider.generateText).not.toHaveBeenCalled();
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
        type: 'MARKETPLACE',
        provider: 'SerpAPI Google Shopping',
      }),
    );
    expect(researchRepo.upsert).toHaveBeenCalledWith(
      'prod_001',
      expect.objectContaining({
        marketSummary: 'Provider-backed opportunity.',
        selectedCandidateId: null,
      }),
    );
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESEARCH_RUN_COMPLETED' }),
    );
  });

  it('should return an empty run when providers return no evidence', async () => {
    const run = {
      id: 'run_empty',
      researchProjectId: null,
      productId: null,
      workflowId: null,
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
      summary: 'No external provider evidence was collected for "Portable Blender". Product Research returned no AI-generated candidates.',
      completedAt: new Date('2026-01-01'),
    };
    const aiProvider: AIProvider = {
      providerName: 'test-ai',
      generateText: vi.fn(),
    };
    const service = new ResearchService(
      {
        create: vi.fn().mockResolvedValue(run),
        updateCompleted: vi.fn().mockResolvedValue(completedRun),
      } as never,
      {} as never,
      {
        create: vi.fn(),
      } as never,
      {
        create: vi.fn(),
      } as never,
      {} as never,
      {} as never,
      {
        create: vi.fn().mockResolvedValue({ id: 'audit_001' }),
      } as never,
      new CandidateScoringService(),
      [
        {
          name: 'MarketplaceResearchProvider',
          providerType: 'marketplace',
          collect: vi.fn().mockResolvedValue([]),
        },
      ],
      aiProvider,
    );

    const result = await service.run({
      productIdea: 'Portable Blender',
    });

    expect(result.candidates).toEqual([]);
    expect(result.sources).toEqual([]);
    expect(result.recommendation.bestCandidateId).toBeUndefined();
    expect(aiProvider.generateText).not.toHaveBeenCalled();
  });

  it('should hide AI estimate sources from public research detail reads', async () => {
    const project = {
      id: 'project_001',
      query: 'Book',
      status: 'ACTIVE',
      selectedCandidateId: null,
      promotedProductId: null,
      summary: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };
    const run = {
      id: 'run_001',
      researchProjectId: project.id,
      productId: null,
      workflowId: null,
      input: {},
      summary: null,
      recommendation: null,
      providerCosts: null,
      startedAt: new Date('2026-01-01'),
      completedAt: new Date('2026-01-01'),
      createdAt: new Date('2026-01-01'),
    };
    const candidate = {
      id: 'cand_001',
      researchRunId: run.id,
      researchProjectId: project.id,
      productId: null,
      name: 'Curated Book Box',
      positioning: 'Curated reading gifts',
      targetMarket: 'US',
      sellingAngle: 'A better monthly reading ritual',
      recommendedPrice: null,
      estimatedCOGS: null,
      estimatedShipping: null,
      estimatedGrossProfit: null,
      grossMarginPercent: null,
      breakEvenRoas: null,
      demandScore: 70,
      trendScore: 70,
      competitionScore: 50,
      marginScore: 60,
      supplierScore: 60,
      creativePotentialScore: 80,
      riskScore: 30,
      winningScore: 70,
      confidence: 'medium',
      status: 'DISCOVERED',
      risks: [],
      metadata: {},
      createdAt: new Date('2026-01-01'),
    };
    const sources = [
      {
        id: 'src_ai',
        researchRunId: run.id,
        candidateId: candidate.id,
        type: 'AI_ESTIMATE',
        provider: 'deepseek',
        url: null,
        externalId: null,
        title: candidate.name,
        extractedSignal: 'AI generated hypothesis',
        rawData: {},
        confidence: 0.4,
        capturedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'src_search',
        researchRunId: run.id,
        candidateId: candidate.id,
        type: 'SEARCH',
        provider: 'SerpAPI Google Search',
        url: 'https://example.com',
        externalId: null,
        title: 'External discussion',
        extractedSignal: 'External demand signal',
        rawData: {},
        confidence: 0.7,
        capturedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
      },
    ];

    const service = new ResearchService(
      {
        findLatestByResearchProjectId: vi.fn().mockResolvedValue(run),
      } as never,
      {
        findByIdOrThrow: vi.fn().mockResolvedValue(project),
      } as never,
      {
        findByResearchProjectId: vi.fn().mockResolvedValue([candidate]),
      } as never,
      {
        findByResearchRunId: vi.fn().mockResolvedValue(sources),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      new CandidateScoringService(),
      [],
    );

    const detail = await service.getProjectDetail(project.id);
    const projectSources = await service.getProjectSources(project.id);

    expect(detail.sources).toHaveLength(1);
    expect(detail.sources.at(0)?.type).toBe('SEARCH');
    expect(projectSources.sources).toHaveLength(1);
    expect(projectSources.sources.at(0)?.type).toBe('SEARCH');
  });

  it('should delete a research project and its research records in dependency order', async () => {
    const project = {
      id: 'project_delete',
      query: 'Desk accessories',
      status: 'ACTIVE',
      selectedCandidateId: null,
      promotedProductId: null,
      summary: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };
    const calls: string[] = [];
    const service = new ResearchService(
      {
        deleteByResearchProjectId: vi.fn().mockImplementation(async () => {
          calls.push('runs');
          return 1;
        }),
      } as never,
      {
        findByIdOrThrow: vi.fn().mockResolvedValue(project),
        delete: vi.fn().mockImplementation(async () => {
          calls.push('project');
          return project;
        }),
      } as never,
      {
        deleteByResearchProjectId: vi.fn().mockImplementation(async () => {
          calls.push('candidates');
          return 2;
        }),
      } as never,
      {
        deleteByResearchProjectId: vi.fn().mockImplementation(async () => {
          calls.push('sources');
          return 3;
        }),
      } as never,
      {} as never,
      {} as never,
      {
        create: vi.fn().mockResolvedValue({ id: 'audit_001' }),
      } as never,
      new CandidateScoringService(),
      [],
    );

    const result = await service.deleteProject(project.id, 'user_001');

    expect(result).toEqual({
      project,
      deletedRuns: 1,
      deletedCandidates: 2,
      deletedSources: 3,
    });
    expect(calls).toEqual(['sources', 'candidates', 'runs', 'project']);
  });
});
