/**
 * Purpose:
 * Unit tests for QueryIntelligenceService.
 *
 * Responsibilities:
 * - Verify derived discovery queries come from provider evidence
 * - Verify seed query is preserved and derived queries are capped
 *
 * Dependencies:
 * - vitest
 * - QueryIntelligenceService
 */

import { describe, expect, it } from 'vitest';
import { QueryIntelligenceService } from '@/services/query-intelligence.service';
import type {
  NormalizedResearchSourceInput,
  ResearchRunConfig,
} from '@/schemas/research.schema';

const config: ResearchRunConfig = {
  targetMarket: 'US',
  targetMarginPercent: 40,
  riskTolerance: 'medium',
  excludedCategories: [],
  objective: 'find_winning_product',
  maxCandidates: 5,
  maxDerivedQueries: 2,
  sourcing: {
    targetSource: '1688',
    targetCurrency: 'USD',
    landedCostAssumptions: {},
  },
  supplementalProviders: ['marketplace', 'trend', 'keyword'],
};

describe('QueryIntelligenceService', () => {
  it('selects capped provider-backed derived queries after the seed query', () => {
    const sources: NormalizedResearchSourceInput[] = [
      {
        type: 'KEYWORD',
        provider: 'DataForSEO Google Ads Search Volume',
        externalId: 'cordless portable blender',
        title: 'cordless portable blender keyword signal',
        extractedSignal: 'cordless portable blender keyword evidence, search volume 12000, CPC 1.8',
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
      {
        type: 'TREND',
        provider: 'SerpAPI Google Trends',
        title: 'portable blender trend signal',
        extractedSignal: 'Trend response captured for portable blender.',
        rawData: {
          query: 'portable blender',
          recentInterestAverage: 82,
          relatedQueries: [
            { query: 'rechargeable portable blender' },
            { query: 'portable blender bottle' },
          ],
        },
        confidence: 0.7,
        capturedAt: new Date('2026-01-01'),
      },
    ];

    const result = new QueryIntelligenceService().selectQueries({
      productIdea: 'portable blender',
      config,
      sources,
    });

    expect(result.seedQuery).toBe('portable blender');
    expect(result.selectedQueries).toHaveLength(3);
    expect(result.selectedQueries.at(0)).toEqual(
      expect.objectContaining({
        query: 'portable blender',
        source: 'SEED_QUERY',
      }),
    );
    expect(result.selectedQueries.slice(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'QUERY_INTELLIGENCE' }),
      ]),
    );
    expect(result.candidateQueries.map((query) => query.query)).toContain('cordless portable blender');
    expect(result.candidateQueries.map((query) => query.query)).not.toContain('portable blender');
  });

  it('falls back to seed-query-only discovery when evidence has no usable queries', () => {
    const result = new QueryIntelligenceService().selectQueries({
      productIdea: 'portable blender',
      config: { ...config, maxDerivedQueries: 5 },
      sources: [
        {
          type: 'SEARCH',
          provider: 'SerpAPI Google Search',
          title: 'General ecommerce guide',
          extractedSignal: 'Article about selling online without product-specific keywords.',
          rawData: {},
          confidence: 0.68,
          capturedAt: new Date('2026-01-01'),
        },
      ],
    });

    expect(result.selectedQueries).toEqual([
      expect.objectContaining({
        query: 'portable blender',
        source: 'SEED_QUERY',
      }),
    ]);
    expect(result.candidateQueries).toEqual([]);
  });
});
