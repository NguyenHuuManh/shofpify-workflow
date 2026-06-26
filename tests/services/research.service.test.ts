/**
 * Purpose:
 * Unit tests for ResearchService.
 */

import { describe, expect, it, vi } from 'vitest';
import { ResearchService } from '@/services/research.service';
import { CandidateScoringService } from '@/services/candidate-scoring.service';
import type { AIProvider } from '@/types/ai-provider.interface';
import type { ResearchProviderCollectInput } from '@/types/research.types';

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

  it('should aggregate multiple marketplace listings before creating candidates', async () => {
    const run = {
      id: 'run_aggregate',
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
          id: 'cand_aggregate',
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
    const marketplaceSources = [
      {
        type: 'MARKETPLACE',
        provider: 'Apify Google Shopping',
        url: 'https://example.com/blender-a',
        externalId: 'listing_a',
        title: 'USB Portable Blender',
        extractedSignal: 'USB Portable Blender listing, 1200 reviews',
        rawData: {
          metrics: {
            price: 39.99,
            reviewCount: 1200,
            demandSignal: 82,
          },
        },
        confidence: 0.74,
        capturedAt: new Date('2026-01-01'),
      },
      {
        type: 'MARKETPLACE',
        provider: 'Apify Amazon Product Scraper',
        url: 'https://example.com/blender-b',
        externalId: 'listing_b',
        title: 'USB Portable Blender',
        extractedSignal: 'USB Portable Blender listing, 800 reviews',
        rawData: {
          metrics: {
            price: 42.99,
            reviewCount: 800,
            demandSignal: 78,
          },
        },
        confidence: 0.71,
        capturedAt: new Date('2026-01-01'),
      },
    ];
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
          name: 'MarketplaceResearchProvider',
          providerType: 'marketplace',
          collect: vi.fn().mockResolvedValue(marketplaceSources),
        },
      ],
    );

    const result = await service.run({ productIdea: 'Portable Blender' });

    expect(result.candidates).toHaveLength(1);
    expect(candidateRepo.create).toHaveBeenCalledTimes(1);
    expect(candidateRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'USB Portable Blender',
        recommendedPrice: 41.49,
        metadata: expect.objectContaining({
          generatedFrom: 'product_aggregation',
          aggregation: expect.objectContaining({
            method: 'deterministic_dedup',
            sourceUrls: ['https://example.com/blender-a', 'https://example.com/blender-b'],
            mergedMetrics: expect.objectContaining({
              sourceCount: 2,
              medianPrice: 41.49,
              reviewCountTotal: 2000,
            }),
          }),
        }),
      }),
    );
    expect(sourceRepo.create).toHaveBeenCalledTimes(2);
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ candidateId: 'cand_aggregate', url: 'https://example.com/blender-a' }),
    );
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ candidateId: 'cand_aggregate', url: 'https://example.com/blender-b' }),
    );
  });

  it('should use provider-backed query intelligence before marketplace discovery', async () => {
    const run = {
      id: 'run_query_intelligence',
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
    const keywordProvider = {
      name: 'KeywordResearchProvider',
      providerType: 'keyword' as const,
      collect: vi.fn().mockResolvedValue([
        {
          type: 'KEYWORD',
          provider: 'DataForSEO Google Ads Search Volume',
          externalId: 'cordless portable blender',
          title: 'cordless portable blender keyword signal',
          extractedSignal: 'cordless portable blender keyword evidence, search volume 12000',
          rawData: {
            keyword: 'cordless portable blender',
            metrics: {
              searchVolume: 12000,
              cpc: 1.8,
              competitionSignal: 42,
            },
          },
          confidence: 0.74,
          capturedAt: new Date('2026-01-01'),
        },
      ]),
    };
    const marketplaceProvider = {
      name: 'MarketplaceResearchProvider',
      providerType: 'marketplace' as const,
      collect: vi.fn().mockImplementation(async (input: ResearchProviderCollectInput) => {
        const derivedQuery = input.collectionContext?.selectedQueries?.at(1)?.query;
        return [
          {
            type: 'MARKETPLACE',
            provider: 'SerpAPI Google Shopping',
            url: 'https://store.example.com/cordless-portable-blender',
            externalId: 'shopping_query_001',
            title: 'Cordless Portable Blender',
            extractedSignal: `Marketplace listing collected for ${derivedQuery}`,
            rawData: {
              queryUsed: derivedQuery,
              querySource: input.collectionContext?.selectedQueries?.at(1)?.source,
              queryScore: input.collectionContext?.selectedQueries?.at(1)?.score,
              collectionStage: input.collectionContext?.stage,
              metrics: {
                price: 49,
                reviewCount: 900,
              },
            },
            confidence: 0.72,
            capturedAt: new Date('2026-01-01'),
          },
        ];
      }),
    };
    const candidateRepo = {
      create: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          id: 'cand_query_intelligence',
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
    const runRepo = {
      create: vi.fn().mockResolvedValue(run),
      updateCompleted: vi.fn().mockImplementation((_id, input) =>
        Promise.resolve({
          ...run,
          ...input,
          completedAt: new Date('2026-01-01'),
        }),
      ),
    };

    const service = new ResearchService(
      runRepo as never,
      {} as never,
      candidateRepo as never,
      sourceRepo as never,
      {} as never,
      {} as never,
      {
        create: vi.fn().mockResolvedValue({ id: 'audit_001' }),
      } as never,
      new CandidateScoringService(),
      [keywordProvider, marketplaceProvider],
    );

    const result = await service.run({
      productIdea: 'portable blender',
      config: {
        supplementalProviders: ['keyword', 'marketplace'],
        maxDerivedQueries: 1,
      },
    });

    expect(keywordProvider.collect).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionContext: expect.objectContaining({ stage: 'query_intelligence' }),
      }),
    );
    expect(marketplaceProvider.collect).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionContext: expect.objectContaining({
          stage: 'candidate_discovery',
          queries: ['portable blender', 'cordless portable blender'],
        }),
      }),
    );
    expect(runRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          queryIntelligence: expect.objectContaining({
            selectedQueries: expect.arrayContaining([
              expect.objectContaining({ query: 'cordless portable blender' }),
            ]),
          }),
        }),
      }),
    );
    expect(result.candidates).toHaveLength(1);
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MARKETPLACE',
        candidateId: 'cand_query_intelligence',
        rawData: expect.objectContaining({
          queryUsed: 'cordless portable blender',
          querySource: 'QUERY_INTELLIGENCE',
          collectionStage: 'candidate_discovery',
        }),
      }),
    );
  });

  it('should prefer DataForSEO Merchant marketplace evidence before Apify fallback', async () => {
    const run = {
      id: 'run_merchant_primary',
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
    const merchantProvider = {
      name: 'DataForSeoMerchantProvider',
      providerType: 'marketplace' as const,
      collect: vi.fn().mockResolvedValue([
        {
          type: 'MARKETPLACE',
          provider: 'DataForSEO Merchant Google Products',
          url: 'https://merchant.example.com/product',
          externalId: 'merchant_product_001',
          title: 'Cordless Portable Blender',
          extractedSignal: 'Cordless Portable Blender marketplace listing, price 49 USD, 1200 reviews',
          rawData: {
            queryUsed: 'portable blender',
            querySource: 'SEED_QUERY',
            collectionStage: 'candidate_discovery',
            metrics: {
              price: 49,
              currency: 'USD',
              rating: 4.6,
              reviewCount: 1200,
              demandSignal: 82,
            },
          },
          confidence: 0.78,
          capturedAt: new Date('2026-01-01'),
        },
      ]),
    };
    const apifyProvider = {
      name: 'ApifyCandidateDiscoveryProvider',
      providerType: 'marketplace' as const,
      collect: vi.fn().mockResolvedValue([
        {
          type: 'MARKETPLACE',
          provider: 'Apify Google Shopping',
          url: 'https://apify.example.com/product',
          title: 'Fallback Blender',
          extractedSignal: 'Fallback listing',
          confidence: 0.7,
          capturedAt: new Date('2026-01-01'),
        },
      ]),
    };
    const candidateRepo = {
      create: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          id: 'cand_merchant_primary',
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
      [merchantProvider, apifyProvider],
    );

    const result = await service.run({
      productIdea: 'portable blender',
      config: {
        supplementalProviders: ['marketplace'],
      },
    });

    expect(merchantProvider.collect).toHaveBeenCalledTimes(1);
    expect(apifyProvider.collect).not.toHaveBeenCalled();
    expect(result.candidates).toHaveLength(1);
    expect(candidateRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Cordless Portable Blender',
        metadata: expect.objectContaining({
          generatedFrom: 'product_aggregation',
        }),
      }),
    );
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MARKETPLACE',
        provider: 'DataForSEO Merchant Google Products',
        candidateId: 'cand_merchant_primary',
      }),
    );
  });

  it('should not collect web search articles by default', async () => {
    const run = {
      id: 'run_default_providers',
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
    const searchProvider = {
      name: 'SearchResearchProvider',
      providerType: 'search' as const,
      collect: vi.fn().mockResolvedValue([
        {
          type: 'SEARCH',
          provider: 'SerpAPI Google Search',
          url: 'https://example.com/blog/trending-products',
          title: 'Top products to sell this year',
          extractedSignal: 'Article result',
          confidence: 0.7,
          capturedAt: new Date('2026-01-01'),
        },
      ]),
    };
    const marketplaceProvider = {
      name: 'MarketplaceResearchProvider',
      providerType: 'marketplace' as const,
      collect: vi.fn().mockResolvedValue([
        {
          type: 'MARKETPLACE',
          provider: 'SerpAPI Google Shopping',
          url: 'https://store.example.com/self-cleaning-blender',
          externalId: 'shopping_001',
          title: 'Self-cleaning Portable Blender',
          extractedSignal: 'Marketplace product listing with price and reviews',
          rawData: {
            metrics: {
              price: 79,
              reviewCount: 450,
            },
          },
          confidence: 0.72,
          capturedAt: new Date('2026-01-01'),
        },
      ]),
    };
    const candidateRepo = {
      create: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          id: 'cand_default_marketplace',
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
      [searchProvider, marketplaceProvider],
    );

    const result = await service.run({
      productIdea: 'Portable Blender',
    });

    expect(searchProvider.collect).not.toHaveBeenCalled();
    expect(marketplaceProvider.collect).toHaveBeenCalledOnce();
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates.at(0)?.metadata).toEqual(
      expect.objectContaining({
        sourceType: 'MARKETPLACE',
      }),
    );
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MARKETPLACE',
        candidateId: 'cand_default_marketplace',
      }),
    );
  });

  it('should not create candidates directly from 1688 sourcing evidence during discovery', async () => {
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
      summary: 'No discovery candidates.',
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

    expect(result.candidates).toEqual([]);
    expect(candidateRepo.create).not.toHaveBeenCalled();
    expect(sourceRepo.create).not.toHaveBeenCalled();
  });

  it('should not create product candidates from search articles or videos', async () => {
    const run = {
      id: 'run_search_content',
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
    const sourceRepo = {
      create: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          id: `src_${sourceRepo.create.mock.calls.length}`,
          createdAt: new Date('2026-01-01'),
          ...input,
        }),
      ),
    };
    const searchSources = [
      {
        type: 'SEARCH',
        provider: 'SerpAPI Google Search',
        url: 'https://www.youtube.com/watch?v=abc123',
        externalId: 'yt_001',
        title: 'New Amazon FBA Product Research Techniques for 2024',
        extractedSignal: 'Video result about research techniques, not a product listing',
        rawData: {
          source: 'YouTube',
          duration: '12:48',
        },
        confidence: 0.82,
        capturedAt: new Date('2026-01-01'),
      },
      {
        type: 'SEARCH',
        provider: 'SerpAPI Google Search',
        url: 'https://example.com/blog/how-to-find-products-to-sell',
        externalId: 'blog_001',
        title: 'How to Find Products to Sell on Amazon: 7 Proven Methods',
        extractedSignal: 'Guide article about product research, not a product listing',
        rawData: {
          source: 'Example Blog',
        },
        confidence: 0.76,
        capturedAt: new Date('2026-01-01'),
      },
    ];
    const aiProvider: AIProvider = {
      providerName: 'test-ai',
      generateText: vi.fn(),
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
          name: 'SearchResearchProvider',
          providerType: 'search',
          collect: vi.fn().mockResolvedValue(searchSources),
        },
      ],
      aiProvider,
    );

    const result = await service.run({
      productIdea: 'Amazon product research',
      config: {
        supplementalProviders: ['search'],
      },
    });

    expect(result.candidates).toEqual([]);
    expect(candidateRepo.create).not.toHaveBeenCalled();
    expect(aiProvider.generateText).not.toHaveBeenCalled();
    expect(sourceRepo.create).toHaveBeenCalledTimes(2);
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: undefined,
        type: 'SEARCH',
        url: 'https://www.youtube.com/watch?v=abc123',
      }),
    );
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: undefined,
        type: 'SEARCH',
        url: 'https://example.com/blog/how-to-find-products-to-sell',
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

  it('should not create or link 1688 sources as candidates during discovery', async () => {
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
          id: 'cand_marketplace',
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
          providerType: 'marketplace',
          collect: vi.fn().mockResolvedValue([marketplaceSource, sourcingSource]),
        },
      ],
    );

    await service.run({
      productIdea: 'Portable Blender',
    });

    expect(candidateRepo.create).toHaveBeenCalledTimes(1);
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: 'cand_marketplace',
        type: 'MARKETPLACE',
        url: 'https://store.example.com/portable-blender-retail',
      }),
    );
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: undefined,
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
      deletedDiscoveryJobs: 0,
      deletedVerifications: 0,
    });
    expect(calls).toEqual(['sources', 'candidates', 'runs', 'project']);
  });
});
