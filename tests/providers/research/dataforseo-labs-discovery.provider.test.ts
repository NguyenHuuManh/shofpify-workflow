/**
 * Purpose:
 * Unit tests for DataForSEO Labs autonomous discovery provider.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataForSeoLabsDiscoveryProvider } from '@/providers/research';
import type { ResearchProviderCollectInput } from '@/types/research.types';

const input: ResearchProviderCollectInput = {
  productIdea: 'autonomous product discovery',
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

describe('DataForSeoLabsDiscoveryProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DATAFORSEO_LOGIN;
    delete process.env.DATAFORSEO_PASSWORD;
  });

  it('normalizes DataForSEO Labs top searches into category-backed keyword evidence', async () => {
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
                    keyword_data: {
                      keyword: 'pet travel water bottle',
                      keyword_info: {
                        search_volume: 9000,
                        cpc: 1.4,
                        competition_index: 38,
                      },
                      categories: [{ category_name: 'Animals & Pet Supplies' }],
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new DataForSeoLabsDiscoveryProvider();
    const result = await provider.collect(input);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.dataforseo.com/v3/dataforseo_labs/google/top_searches/live',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        type: 'KEYWORD',
        provider: 'DataForSEO Labs Top Searches',
        externalId: 'pet travel water bottle',
        rawData: expect.objectContaining({
          keyword: 'pet travel water bottle',
          categories: ['Animals & Pet Supplies'],
          dataForSeoEndpoint: 'dataforseo_labs_google_top_searches',
          discoveryStage: 'autonomous_category_keyword_discovery',
        }),
      }),
    );
  });
});
