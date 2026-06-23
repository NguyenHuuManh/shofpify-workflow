/**
 * Purpose:
 * Unit tests for candidate-level Product Research sourcing enrichment.
 */

import { describe, expect, it, vi } from 'vitest';
import { CandidateSourcingService } from '@/services/candidate-sourcing.service';
import { CandidateScoringService } from '@/services/candidate-scoring.service';

describe('CandidateSourcingService', () => {
  it('enriches an existing candidate with 1688 sourcing evidence and cost fields', async () => {
    const candidate = {
      id: 'cand_001',
      researchRunId: 'run_001',
      researchProjectId: 'project_001',
      productId: null,
      name: 'Portable Blender Retail Listing',
      positioning: 'Compact blender with USB charging',
      targetMarket: 'US',
      sellingAngle: 'Smoothies anywhere',
      recommendedPrice: 69,
      estimatedCOGS: null,
      estimatedShipping: null,
      factoryUnitCost: null,
      moq: null,
      landedCost: null,
      landedCostBreakdown: null,
      estimatedGrossProfit: null,
      grossMarginPercent: null,
      breakEvenRoas: null,
      demandScore: 78,
      trendScore: 65,
      competitionScore: 52,
      marginScore: null,
      supplierScore: null,
      sourcingScore: null,
      factoryCostScore: null,
      logisticsScore: null,
      creativePotentialScore: 80,
      riskScore: 35,
      winningScore: 70,
      confidence: 'medium',
      status: 'SHORTLISTED',
      risks: [],
      metadata: {
        evidence: {
          sourceCount: 1,
          sourceTypes: ['MARKETPLACE'],
        },
      },
      createdAt: new Date('2026-01-01'),
    };
    const run = {
      id: 'run_001',
      researchProjectId: 'project_001',
      productId: null,
      workflowId: null,
      input: {
        productIdea: 'Portable Blender',
        config: {
          targetMarket: 'US',
          sourcing: {
            targetSource: '1688',
            targetCurrency: 'USD',
            landedCostAssumptions: {
              agentFeePercent: 8,
              internationalFreightPerUnit: 6,
              customsDutyPercent: 5,
              packagingPerUnit: 1,
              qcPerUnit: 0.5,
            },
          },
        },
      },
      summary: null,
      recommendation: null,
      providerCosts: null,
      startedAt: new Date('2026-01-01'),
      completedAt: new Date('2026-01-01'),
      createdAt: new Date('2026-01-01'),
    };
    const sourcingSource = {
      type: 'SOURCING',
      provider: 'apify_1688',
      url: 'https://detail.1688.com/offer/123456.html',
      externalId: '123456',
      title: 'Portable Blender Factory Offer',
      extractedSignal: '1688 offer with MOQ 100 and factory unit cost 12',
      rawData: {
        metrics: {
          factoryUnitCost: 12,
          shippingCost: 1.5,
          moq: 100,
          sourcingSignal: 82,
          factoryCostSignal: 79,
          logisticsSignal: 71,
        },
      },
      confidence: 0.78,
      capturedAt: new Date('2026-01-01'),
    };
    const candidateRepo = {
      findByIdOrThrow: vi.fn().mockResolvedValue(candidate),
      updateSourcingAnalysis: vi.fn().mockImplementation((_id, input) =>
        Promise.resolve({
          ...candidate,
          ...input,
        }),
      ),
    };
    const runRepo = {
      findByIdOrThrow: vi.fn().mockResolvedValue(run),
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
    const provider = {
      name: 'Sourcing1688ResearchProvider',
      providerType: 'sourcing' as const,
      collect: vi.fn().mockResolvedValue([sourcingSource]),
    };
    const service = new CandidateSourcingService(
      candidateRepo as never,
      runRepo as never,
      sourceRepo as never,
      { create: vi.fn().mockResolvedValue({ id: 'audit_001' }) } as never,
      new CandidateScoringService(),
      provider,
    );

    const result = await service.enrichCandidate('cand_001', {
      mode: 'agent_search',
    });

    expect(provider.collect).toHaveBeenCalledWith(
      expect.objectContaining({
        productIdea: 'Portable Blender Retail Listing',
        config: expect.objectContaining({
          supplementalProviders: ['sourcing'],
        }),
      }),
    );
    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: 'cand_001',
        type: 'SOURCING',
        provider: 'apify_1688',
      }),
    );
    expect(candidateRepo.updateSourcingAnalysis).toHaveBeenCalledWith(
      'cand_001',
      expect.objectContaining({
        factoryUnitCost: 12,
        moq: 100,
        landedCost: 22.56,
        sourcingScore: 82,
        factoryCostScore: 79,
        logisticsScore: 71,
        metadata: expect.objectContaining({
          sourcingEnrichment: expect.objectContaining({
            status: 'ENRICHED',
            mode: 'agent_search',
            sourceCount: 1,
          }),
        }),
      }),
    );
    expect(result.summary.status).toBe('ENRICHED');
    expect(result.sources).toHaveLength(1);
  });

  it('persists a manual 1688 URL without inventing cost metrics', async () => {
    const candidate = {
      id: 'cand_002',
      researchRunId: 'run_002',
      researchProjectId: 'project_002',
      productId: null,
      name: 'Desk Organizer',
      positioning: 'Desk storage',
      targetMarket: 'US',
      sellingAngle: null,
      recommendedPrice: 39,
      estimatedCOGS: null,
      estimatedShipping: null,
      factoryUnitCost: null,
      moq: null,
      landedCost: null,
      landedCostBreakdown: null,
      estimatedGrossProfit: null,
      grossMarginPercent: null,
      breakEvenRoas: null,
      demandScore: 60,
      trendScore: 50,
      competitionScore: 45,
      marginScore: null,
      supplierScore: null,
      sourcingScore: null,
      factoryCostScore: null,
      logisticsScore: null,
      creativePotentialScore: 70,
      riskScore: 35,
      winningScore: 60,
      confidence: 'medium',
      status: 'DISCOVERED',
      risks: [],
      metadata: {},
      createdAt: new Date('2026-01-01'),
    };
    const candidateRepo = {
      findByIdOrThrow: vi.fn().mockResolvedValue(candidate),
      updateSourcingAnalysis: vi.fn().mockImplementation((_id, input) =>
        Promise.resolve({
          ...candidate,
          ...input,
        }),
      ),
    };
    const service = new CandidateSourcingService(
      candidateRepo as never,
      {
        findByIdOrThrow: vi.fn().mockResolvedValue({
          id: 'run_002',
          input: {},
        }),
      } as never,
      {
        create: vi.fn().mockImplementation((input) =>
          Promise.resolve({
            id: 'src_manual',
            createdAt: new Date('2026-01-01'),
            ...input,
          }),
        ),
      } as never,
      { create: vi.fn().mockResolvedValue({ id: 'audit_002' }) } as never,
      new CandidateScoringService(),
      {
        name: 'Sourcing1688ResearchProvider',
        providerType: 'sourcing' as const,
        collect: vi.fn().mockResolvedValue([]),
      },
    );

    const result = await service.enrichCandidate('cand_002', {
      mode: 'manual_url',
      sourcingUrl: 'https://detail.1688.com/offer/987654.html',
    });

    expect(candidateRepo.updateSourcingAnalysis).toHaveBeenCalledWith(
      'cand_002',
      expect.objectContaining({
        factoryUnitCost: undefined,
        moq: undefined,
        landedCost: undefined,
        metadata: expect.objectContaining({
          sourcingEnrichment: expect.objectContaining({
            status: 'NO_COST_EVIDENCE',
            sourcingUrl: 'https://detail.1688.com/offer/987654.html',
          }),
        }),
      }),
    );
    expect(result.summary.status).toBe('NO_COST_EVIDENCE');
  });
});
