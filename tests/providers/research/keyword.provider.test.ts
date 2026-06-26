/**
 * Purpose:
 * Unit tests for keyword intelligence research provider.
 *
 * Responsibilities:
 * - Verify DataForSEO keyword suggestions are collected without user-entered product keywords
 * - Preserve normalized keyword metrics for query intelligence
 *
 * Dependencies:
 * - vitest
 * - KeywordResearchProvider
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeywordResearchProvider } from '@/providers/research';
import type { ResearchProviderCollectInput } from '@/types/research.types';

const input: ResearchProviderCollectInput = {
  productIdea: 'sample discovery query',
  config: {
    targetMarket: 'US',
    targetMarginPercent: 40,
    riskTolerance: 'medium',
    excludedCategories: [],
    objective: 'find_winning_product',
    maxCandidates: 5,
    maxDerivedQueries: 5,
    sourcing: {
      targetSource: '1688',
      targetCurrency: 'USD',
      landedCostAssumptions: {},
    },
    supplementalProviders: ['keyword'],
  },
  candidates: [],
};

describe('KeywordResearchProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DATAFORSEO_LOGIN;
    delete process.env.DATAFORSEO_PASSWORD;
    delete process.env.SERPAPI_API_KEY;
  });

  it('normalizes DataForSEO keyword suggestions into KEYWORD evidence', async () => {
    process.env.DATAFORSEO_LOGIN = 'login';
    process.env.DATAFORSEO_PASSWORD = 'password';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tasks: [
          {
            result: [
              {
                items: [
                  {
                    keyword: 'smart home gadget organizer',
                    search_volume: 14800,
                    cpc: 1.75,
                    competition_index: 44,
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new KeywordResearchProvider();
    const result = await provider.collect(input);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        type: 'KEYWORD',
        provider: 'DataForSEO Google Ads Keywords For Keywords',
        externalId: 'smart home gadget organizer',
        rawData: expect.objectContaining({
          keyword: 'smart home gadget organizer',
          dataForSeoEndpoint: 'keywords_for_keywords',
          metrics: expect.objectContaining({
            searchVolume: 14800,
            cpc: 1.75,
            competitionSignal: 44,
          }),
        }),
      }),
    );
  });
});
