/**
 * Purpose:
 * Unit tests for DataForSEO Merchant marketplace validation provider.
 *
 * Responsibilities:
 * - Verify Merchant task flow is called through the provider layer
 * - Verify Google Shopping products normalize into MARKETPLACE evidence
 *
 * Dependencies:
 * - vitest
 * - DataForSeoMerchantProvider
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataForSeoMerchantProvider } from '@/providers/research';
import type { ResearchProviderCollectInput } from '@/types/research.types';

const input: ResearchProviderCollectInput = {
  productIdea: 'portable blender',
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
    supplementalProviders: ['marketplace'],
  },
  candidates: [],
  collectionContext: {
    stage: 'candidate_discovery',
    queries: ['cordless portable blender'],
    selectedQueries: [
      {
        query: 'cordless portable blender',
        source: 'QUERY_INTELLIGENCE',
        sourceTypes: ['KEYWORD'],
        score: 86,
        reason: 'provider-backed score 86',
      },
    ],
  },
};

describe('DataForSeoMerchantProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DATAFORSEO_LOGIN;
    delete process.env.DATAFORSEO_PASSWORD;
  });

  it('normalizes Merchant Google Products into MARKETPLACE sources with query provenance', async () => {
    process.env.DATAFORSEO_LOGIN = 'login';
    process.env.DATAFORSEO_PASSWORD = 'password';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [{ id: 'merchant_task_001', status_code: 20100 }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [
            {
              result: [
                {
                  items: [
                    {
                      product_id: 'shopping_001',
                      title: 'Cordless Portable Blender',
                      url: 'https://example.com/blender',
                      price: { current: 49, currency: 'USD' },
                      rating: 4.6,
                      reviews_count: 1200,
                      seller: 'Example Shop',
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new DataForSeoMerchantProvider(0, 1);
    const result = await provider.collect(input);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.dataforseo.com/v3/merchant/google/products/task_post',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.dataforseo.com/v3/merchant/google/products/task_get/advanced/merchant_task_001',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        type: 'MARKETPLACE',
        provider: 'DataForSEO Merchant Google Products',
        url: 'https://example.com/blender',
        externalId: 'shopping_001',
        title: 'Cordless Portable Blender',
        rawData: expect.objectContaining({
          queryUsed: 'cordless portable blender',
          querySource: 'QUERY_INTELLIGENCE',
          queryScore: 86,
          collectionStage: 'candidate_discovery',
          metrics: expect.objectContaining({
            price: 49,
            currency: 'USD',
            rating: 4.6,
            reviewCount: 1200,
            seller: 'Example Shop',
          }),
        }),
      }),
    );
  });
});
