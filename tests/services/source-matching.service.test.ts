/**
 * Purpose:
 * Unit tests for SourceMatchingService.
 *
 * Responsibilities:
 * - Verify AI structured source match reviews are persisted
 * - Verify insufficient evidence and provider failure behavior
 * - Verify reviewer decisions update candidate metadata
 *
 * Dependencies:
 * - SourceMatchingService
 * - Vitest
 */

import { describe, expect, it, vi } from 'vitest';
import { SourceMatchingService } from '@/services/source-matching.service';
import type { AIProvider } from '@/types/ai-provider.interface';

const candidate = {
  id: 'cand_001',
  researchRunId: 'run_001',
  researchProjectId: 'project_001',
  productId: null,
  name: 'Portable Blender',
  positioning: 'Compact smoothie maker',
  targetMarket: 'US',
  sellingAngle: 'Blend anywhere',
  recommendedPrice: null,
  estimatedCOGS: null,
  estimatedShipping: null,
  factoryUnitCost: null,
  moq: null,
  landedCost: null,
  landedCostBreakdown: null,
  estimatedGrossProfit: null,
  grossMarginPercent: null,
  breakEvenRoas: null,
  demandScore: null,
  trendScore: null,
  competitionScore: null,
  marginScore: null,
  supplierScore: null,
  sourcingScore: null,
  factoryCostScore: null,
  logisticsScore: null,
  creativePotentialScore: null,
  riskScore: null,
  winningScore: null,
  confidence: 'medium',
  status: 'DISCOVERED',
  risks: [],
  metadata: {},
  createdAt: new Date('2026-01-01'),
};

const marketplaceSource = {
  id: 'src_marketplace',
  researchRunId: 'run_001',
  candidateId: 'cand_001',
  type: 'MARKETPLACE',
  provider: 'dataforseo',
  url: 'https://store.example/blender',
  externalId: 'marketplace_001',
  title: 'Portable Blender Store Listing',
  extractedSignal: 'Portable blender selling for 59 USD with compact USB charging.',
  rawData: { price: 59, color: 'white' },
  confidence: 0.8,
  capturedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
};

const sourcingSource = {
  id: 'src_sourcing',
  researchRunId: 'run_001',
  candidateId: 'cand_001',
  type: 'SOURCING',
  provider: 'apify',
  url: 'https://detail.1688.com/offer/123.html',
  externalId: '1688_001',
  title: 'Portable Blender 1688 Offer',
  extractedSignal: '1688 portable blender offer with MOQ 100 and USB charging.',
  rawData: { moq: 100, factoryUnitCost: 12 },
  confidence: 0.72,
  capturedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
};

function buildService(options?: {
  aiText?: string;
  aiRejects?: boolean;
  sources?: unknown[];
  candidateMetadata?: unknown;
}) {
  const candidateRepo = {
    findByIdOrThrow: vi.fn().mockResolvedValue({
      ...candidate,
      metadata: options?.candidateMetadata ?? {},
    }),
    updateMetadata: vi.fn().mockImplementation((id, metadata) =>
      Promise.resolve({
        ...candidate,
        id,
        metadata,
      }),
    ),
  };
  const sourceRepo = {
    findByCandidateScope: vi.fn().mockResolvedValue(
      options?.sources ?? [marketplaceSource, sourcingSource],
    ),
  };
  const aiProvider: AIProvider = {
    providerName: 'test-ai',
    generateText: options?.aiRejects
      ? vi.fn().mockRejectedValue(new Error('provider failed'))
      : vi.fn().mockResolvedValue({
          text:
            options?.aiText ??
            JSON.stringify({
              matches: [
                {
                  sourceId: 'src_marketplace',
                  matchedSourceId: 'src_sourcing',
                  matchStatus: 'POTENTIAL_MATCH',
                  confidenceScore: 82,
                  reasons: ['same portable blender function'],
                  warnings: ['image comparison unavailable'],
                  recommendedAction: 'REVIEW_BEFORE_LINKING',
                },
              ],
            }),
          model: 'test-model',
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        }),
  };

  return {
    service: new SourceMatchingService({
      candidateRepo: candidateRepo as never,
      sourceRepo: sourceRepo as never,
      aiProvider,
    }),
    candidateRepo,
    sourceRepo,
    aiProvider,
  };
}

describe('SourceMatchingService', () => {
  it('persists structured AI source match reviews in candidate metadata', async () => {
    const { service, candidateRepo, aiProvider } = buildService();

    const result = await service.reviewCandidateSources('cand_001', {
      sourceIds: ['src_marketplace', 'src_sourcing'],
      reviewerMode: 'draft',
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        sourceId: 'src_marketplace',
        matchedSourceId: 'src_sourcing',
        matchStatus: 'POTENTIAL_MATCH',
        confidenceScore: 82,
        reviewerDecision: null,
      }),
    );
    expect(aiProvider.generateText).toHaveBeenCalledTimes(1);
    expect(candidateRepo.updateMetadata).toHaveBeenCalledWith(
      'cand_001',
      expect.objectContaining({
        sourceMatches: expect.arrayContaining([
          expect.objectContaining({ matchStatus: 'POTENTIAL_MATCH' }),
        ]),
      }),
    );
  });

  it('rejects review when persisted evidence lacks a sourcing pair', async () => {
    const { service } = buildService({ sources: [marketplaceSource] });

    await expect(
      service.reviewCandidateSources('cand_001', {
        sourceIds: ['src_marketplace', 'src_sourcing'],
        reviewerMode: 'draft',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('persists insufficient evidence when the AI provider fails', async () => {
    const { service, candidateRepo } = buildService({ aiRejects: true });

    const result = await service.reviewCandidateSources('cand_001', {
      sourceIds: ['src_marketplace', 'src_sourcing'],
      reviewerMode: 'draft',
    });

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        matchStatus: 'INSUFFICIENT_EVIDENCE',
        confidenceScore: 0,
        recommendedAction: 'FIND_BETTER_SOURCING_MATCH',
      }),
    );
    expect(candidateRepo.updateMetadata).toHaveBeenCalledWith(
      'cand_001',
      expect.objectContaining({
        sourceMatches: expect.arrayContaining([
          expect.objectContaining({ matchStatus: 'INSUFFICIENT_EVIDENCE' }),
        ]),
      }),
    );
  });

  it.each([
    ['LIKELY_MATCH', 94, 'LINK_AS_SOURCING_MATCH'],
    ['WEAK_MATCH', 58, 'KEEP_SEPARATE'],
    ['NOT_A_MATCH', 20, 'KEEP_SEPARATE'],
  ])('persists %s source match reviews', async (status, confidenceScore, recommendedAction) => {
    const { service } = buildService({
      aiText: JSON.stringify({
        matches: [
          {
            sourceId: 'src_marketplace',
            matchedSourceId: 'src_sourcing',
            matchStatus: status,
            confidenceScore,
            reasons: ['status-specific test'],
            warnings: [],
            recommendedAction,
          },
        ],
      }),
    });

    const result = await service.reviewCandidateSources('cand_001', {
      sourceIds: ['src_marketplace', 'src_sourcing'],
      reviewerMode: 'draft',
    });

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        matchStatus: status,
        confidenceScore,
        recommendedAction,
      }),
    );
  });

  it('persists insufficient evidence when AI output contains no valid requested pairs', async () => {
    const { service } = buildService({
      aiText: JSON.stringify({
        matches: [
          {
            sourceId: 'unknown_marketplace',
            matchedSourceId: 'unknown_sourcing',
            matchStatus: 'LIKELY_MATCH',
            confidenceScore: 95,
            reasons: ['invalid pair'],
            warnings: [],
            recommendedAction: 'LINK_AS_SOURCING_MATCH',
          },
        ],
      }),
    });

    const result = await service.reviewCandidateSources('cand_001', {
      sourceIds: ['src_marketplace', 'src_sourcing'],
      reviewerMode: 'draft',
    });

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        matchStatus: 'INSUFFICIENT_EVIDENCE',
        recommendedAction: 'FIND_BETTER_SOURCING_MATCH',
      }),
    );
  });

  it('updates reviewer decision for an existing source match', async () => {
    const existingMatch = {
      id: 'match_001',
      sourceId: 'src_marketplace',
      matchedSourceId: 'src_sourcing',
      matchStatus: 'LIKELY_MATCH',
      confidenceScore: 92,
      reasons: ['strong title and function overlap'],
      warnings: [],
      recommendedAction: 'LINK_AS_SOURCING_MATCH',
      reviewerDecision: null,
      reviewedAt: new Date('2026-01-01').toISOString(),
    };
    const { service, candidateRepo } = buildService({
      candidateMetadata: { sourceMatches: [existingMatch] },
    });

    const result = await service.decideSourceMatch('cand_001', 'match_001', {
      decision: 'CONFIRMED_MATCH',
      reviewerId: 'reviewer_001',
      comment: 'Confirmed by reviewer',
    });

    expect(result.reviewerDecision).toBe('CONFIRMED_MATCH');
    expect(candidateRepo.updateMetadata).toHaveBeenCalledWith(
      'cand_001',
      expect.objectContaining({
        sourceMatches: expect.arrayContaining([
          expect.objectContaining({
            id: 'match_001',
            reviewerDecision: 'CONFIRMED_MATCH',
            reviewerId: 'reviewer_001',
          }),
        ]),
      }),
    );
  });
});
