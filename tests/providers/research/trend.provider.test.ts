/**
 * Purpose:
 * Unit tests for supplemental trend research provider.
 *
 * Responsibilities:
 * - Verify DataForSEO trend evidence is preferred when configured
 * - Preserve normalized trend metrics for scoring
 *
 * Dependencies:
 * - vitest
 * - TrendResearchProvider
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrendResearchProvider } from '@/providers/research';
import type { ResearchProviderCollectInput } from '@/types/research.types';

const input: ResearchProviderCollectInput = {
  productIdea: 'portable blender',
  config: {
    targetMarket: 'US',
    targetMarginPercent: 40,
    riskTolerance: 'medium',
    excludedCategories: [],
    objective: 'find_winning_product',
    sourcing: {
      targetSource: '1688',
      targetCurrency: 'USD',
      landedCostAssumptions: {},
    },
    supplementalProviders: ['trend'],
  },
  candidates: [],
};

describe('TrendResearchProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DATAFORSEO_LOGIN;
    delete process.env.DATAFORSEO_PASSWORD;
    delete process.env.SERPAPI_API_KEY;
  });

  it('normalizes DataForSEO Google Trends response into TREND evidence', async () => {
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
                    data: [
                      { values: [{ value: 40 }, { value: 60 }] },
                      { values: [{ value: 80 }] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new TrendResearchProvider();
    const result = await provider.collect(input);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.dataforseo.com/v3/keywords_data/google_trends/explore/live',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        type: 'TREND',
        provider: 'DataForSEO Google Trends',
        extractedSignal: expect.stringContaining('60'),
        rawData: expect.objectContaining({
          recentInterestAverage: 60,
        }),
      }),
    );
  });
});
