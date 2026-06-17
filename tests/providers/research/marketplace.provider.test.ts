/**
 * Purpose:
 * Unit tests for supplemental marketplace research provider.
 *
 * Responsibilities:
 * - Verify marketplace listings are normalized into source evidence
 * - Preserve pricing and demand metrics in rawData for scoring
 *
 * Dependencies:
 * - vitest
 * - MarketplaceResearchProvider
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketplaceResearchProvider } from '@/providers/research';
import type { ResearchProviderCollectInput } from '@/types/research.types';

const input: ResearchProviderCollectInput = {
  productIdea: 'portable blender',
  config: {
    targetMarket: 'US',
    targetMarginPercent: 40,
    riskTolerance: 'medium',
    excludedCategories: [],
    objective: 'find_winning_product',
    supplementalProviders: ['marketplace'],
  },
  candidates: [],
};

describe('MarketplaceResearchProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DATAFORSEO_LOGIN;
    delete process.env.DATAFORSEO_PASSWORD;
    delete process.env.SERPAPI_API_KEY;
  });

  it('normalizes shopping results into MARKETPLACE sources with metrics', async () => {
    process.env.SERPAPI_API_KEY = 'serp_test_key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          shopping_results: [
            {
              title: 'USB Portable Blender',
              link: 'https://example.com/listing',
              extracted_price: 39.99,
              rating: 4.4,
              reviews: 1250,
              source: 'Example Marketplace',
            },
          ],
        }),
      }),
    );

    const provider = new MarketplaceResearchProvider();
    const result = await provider.collect(input);

    expect(result[0]).toEqual(
      expect.objectContaining({
        type: 'MARKETPLACE',
        provider: 'SerpAPI Google Shopping',
        url: 'https://example.com/listing',
        extractedSignal: expect.stringContaining('1250 reviews'),
        rawData: expect.objectContaining({
          metrics: expect.objectContaining({
            price: 39.99,
            rating: 4.4,
            reviewCount: 1250,
          }),
        }),
      }),
    );
  });

  it('prefers DataForSEO shopping SERP when DataForSEO credentials are configured', async () => {
    process.env.DATAFORSEO_LOGIN = 'login';
    process.env.DATAFORSEO_PASSWORD = 'password';
    process.env.SERPAPI_API_KEY = 'serp_test_key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tasks: [
          {
            result: [
              {
                items: [
                  {
                    title: 'Cordless Portable Blender',
                    url: 'https://example.com/dataforseo-shopping',
                    price: 42.5,
                    rating: 4.3,
                    reviews_count: 860,
                    seller: 'Example Seller',
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new MarketplaceResearchProvider();
    const result = await provider.collect(input);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.dataforseo.com/v3/serp/google/shopping/live/advanced',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        provider: 'DataForSEO Google Shopping SERP',
        url: 'https://example.com/dataforseo-shopping',
        rawData: expect.objectContaining({
          metrics: expect.objectContaining({
            price: 42.5,
            rating: 4.3,
            reviewCount: 860,
          }),
        }),
      }),
    );
  });
});
