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
      create: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          ...candidate,
          ...input,
          id: candidate.id,
          createdAt: candidate.createdAt,
        }),
      ),
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
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates.at(0)?.id).toBe('cand_001');
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

  it('should create candidates directly from 1688 sourcing evidence', async () => {
    const run = {
      id: 'run_sourcing',
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
      summary: 'Collected 1 external source signals (SOURCING) for "Portable Blender" and produced 1 provider-backed product candidates.',
      completedAt: new Date('2026-01-01'),
    };
    const candidateRepo = {
      create: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          id: 'cand_sourcing',
          createdAt: new Date('2026-01-01'),
          ...input,
        }),
      ),
    };
    const sourceRepo = {
      create: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          id: 'src_sourcing',
          createdAt: new Date('2026-01-01'),
          ...input,
        }),
      ),
    };
    const sourcingSource = {
      type: 'SOURCING',
      provider: '1688',
      url: 'https://detail.1688.com/offer/offer_001.html',
      externalId: 'offer_001',
      title: 'USB Portable Blender Factory Listing',
      extractedSignal: '1688 offer with MOQ 100 and factory unit cost 22.5',
      rawData: {
        metrics: {
          productCost: 22.5,
          factoryUnitCost: 22.5,
          shippingCost: 2.5,
          moq: 100,
          sourcingSignal: 80,
          factoryCostSignal: 78,
          logisticsSignal: 75,
        },
      },
      confidence: 0.74,
      capturedAt: new Date('2026-01-01'),
    };
    const service = new ResearchService(
      {
        create: vi.fn().mockResolvedValue(run),
        updateCompleted: vi.fn().mockResolvedValue(completedRun),
      } as never,
      {} as never,
      candidateRepo as never,
      sourceRepo as never,
      {} as never,
      {} as never,
      {
        create: vi.fn().mockResolvedValue({ id: 'audit_001' }),
      } as never,
      new CandidateScoringService(),
      [
        {
          name: 'Sourcing1688ResearchProvider',
          providerType: 'sourcing',
          collect: vi.fn().mockResolvedValue([sourcingSource]),
        },
      ],
    );

    const result = await service.run({
      productIdea: 'Portable Blender',
      config: {
        sourcing: {
          targetSource: '1688',
          targetCurrency: 'USD',
          landedCostAssumptions: {
            agentFeePercent: 8,
            internationalFreightPerUnit: 8,
            customsDutyPercent: 5,
            packagingPerUnit: 1.5,
            qcPerUnit: 0.75,
          },
        },
      },
    });

    expect(result.candidates).toHaveLength(1);
    expect(candidateRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'USB Portable Blender Factory Listing',
        estimatedCOGS: 38.18,
        factoryUnitCost: 22.5,
        moq: 100,
        landedCost: 38.18,
        sourcingScore: 80,
        factoryCostScore: 78,
        logisticsScore: 75,
        metadata: expect.objectContaining({
          evidence: expect.objectContaining({
            sourceTypes: ['SOURCING'],
            backedByExternalEvidence: true,
          }),
        }),
      }),
    );
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: 'cand_sourcing',
        type: 'SOURCING',
        provider: '1688',
      }),
    );
  });

  it('should filter provider-backed candidates by research brief constraints', async () => {
    const run = {
      id: 'run_constraints',
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
    const candidateRepo = {
      create: vi.fn(),
    };
    const highMoqSource = {
      type: 'SOURCING',
      provider: '1688',
      url: 'https://detail.1688.com/offer/high-moq.html',
      externalId: 'high_moq',
      title: 'High MOQ Portable Blender',
      extractedSignal: '1688 offer with MOQ 2000 and factory unit cost 12',
      rawData: {
        metrics: {
          productCost: 12,
          factoryUnitCost: 12,
          moq: 2000,
        },
      },
      confidence: 0.8,
      capturedAt: new Date('2026-01-01'),
    };

    const service = new ResearchService(
      {
        create: vi.fn().mockResolvedValue(run),
        updateCompleted: vi.fn().mockImplementation((_id, input) =>
          Promise.resolve({
            ...run,
            ...input,
            completedAt: new Date('2026-01-01'),
          }),
        ),
      } as never,
      {} as never,
      candidateRepo as never,
      {
        create: vi.fn().mockResolvedValue({ id: 'src_constraints' }),
      } as never,
      {} as never,
      {} as never,
      {
        create: vi.fn().mockResolvedValue({ id: 'audit_001' }),
      } as never,
      new CandidateScoringService(),
      [
        {
          name: 'Sourcing1688ResearchProvider',
          providerType: 'sourcing',
          collect: vi.fn().mockResolvedValue([highMoqSource]),
        },
      ],
    );

    const result = await service.run({
      productIdea: 'Portable Blender',
      config: {
        sourcing: {
          targetSource: '1688',
          targetCurrency: 'USD',
          maxMoq: 500,
          landedCostAssumptions: {},
        },
      },
    });

    expect(result.candidates).toEqual([]);
    expect(candidateRepo.create).not.toHaveBeenCalled();
    expect(result.summary).toContain('max MOQ 500');
  });

  it('should not link marketplace and 1688 sources to the same candidate when they are different items', async () => {
    const run = {
      id: 'run_source_linking',
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
    const candidateRepo = {
      create: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          id: input.metadata.sourceType === 'SOURCING' ? 'cand_sourcing' : 'cand_marketplace',
          createdAt: new Date('2026-01-01'),
          ...input,
        }),
      ),
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
    const marketplaceSource = {
      type: 'MARKETPLACE',
      provider: 'SerpAPI Google Shopping',
      url: 'https://store.example.com/portable-blender-retail',
      externalId: 'store_001',
      title: 'Portable Blender Retail Listing',
      extractedSignal: 'Retail portable blender listing with reviews',
      rawData: {
        metrics: {
          price: 49,
          reviewCount: 1000,
        },
      },
      confidence: 0.7,
      capturedAt: new Date('2026-01-01'),
    };
    const sourcingSource = {
      type: 'SOURCING',
      provider: '1688',
      url: 'https://detail.1688.com/offer/source_001.html',
      externalId: 'source_001',
      title: 'Portable Blender Factory Listing',
      extractedSignal: '1688 portable blender offer with MOQ 100 and factory unit cost 12',
      rawData: {
        metrics: {
          productCost: 12,
          factoryUnitCost: 12,
          moq: 100,
        },
      },
      confidence: 0.8,
      capturedAt: new Date('2026-01-01'),
    };
    const service = new ResearchService(
      {
        create: vi.fn().mockResolvedValue(run),
        updateCompleted: vi.fn().mockImplementation((_id, input) =>
          Promise.resolve({
            ...run,
            ...input,
            completedAt: new Date('2026-01-01'),
          }),
        ),
      } as never,
      {} as never,
      candidateRepo as never,
      sourceRepo as never,
      {} as never,
      {} as never,
      {
        create: vi.fn().mockResolvedValue({ id: 'audit_001' }),
      } as never,
      new CandidateScoringService(),
      [
        {
          name: 'MixedResearchProvider',
          providerType: 'sourcing',
          collect: vi.fn().mockResolvedValue([marketplaceSource, sourcingSource]),
        },
      ],
    );

    await service.run({
      productIdea: 'Portable Blender',
    });

    expect(candidateRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Portable Blender Factory Listing',
        metadata: expect.objectContaining({
          sourceType: 'SOURCING',
          sourceProvider: '1688',
          sourceUrl: 'https://detail.1688.com/offer/source_001.html',
          sourceExternalId: 'source_001',
        }),
      }),
    );
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: 'cand_marketplace',
        type: 'MARKETPLACE',
        url: 'https://store.example.com/portable-blender-retail',
      }),
    );
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: 'cand_sourcing',
        type: 'SOURCING',
        url: 'https://detail.1688.com/offer/source_001.html',
      }),
    );
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
