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
                      gid: 'shopping_001',
                      title: 'Cordless Portable Blender',
                      shopping_url: 'https://www.google.com/shopping/product/123',
                      product_images: ['https://example.com/blender.jpg'],
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
        url: 'https://www.google.com/shopping/product/123',
        externalId: 'shopping_001',
        title: 'Cordless Portable Blender',
        rawData: expect.objectContaining({
          imageUrl: 'https://example.com/blender.jpg',
          images: ['https://example.com/blender.jpg'],
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
            imageUrl: 'https://example.com/blender.jpg',
          }),
        }),
      }),
    );
  });

  it('skips generic Merchant category items that do not include product identity or marketplace signals', async () => {
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
                      title: 'Fashion Accessories',
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

    expect(result).toEqual([]);
  });

  it('normalizes nested Merchant product items instead of container titles', async () => {
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
                      type: 'shopping_results',
                      title: 'Fashion Accessories',
                      items: [
                        {
                          product_id: 'nested_001',
                          title: 'Leather Crossbody Phone Bag',
                          shopping_url: 'https://www.google.com/shopping/product/456',
                          product_images: [{ url: 'https://example.com/bag.jpg' }],
                          price: { current: 29, currency: 'USD' },
                          seller: 'Bag Shop',
                        },
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

    const provider = new DataForSeoMerchantProvider(0, 1);
    const result = await provider.collect(input);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        title: 'Leather Crossbody Phone Bag',
        url: 'https://www.google.com/shopping/product/456',
        externalId: 'nested_001',
        rawData: expect.objectContaining({
          imageUrl: 'https://example.com/bag.jpg',
        }),
      }),
    );
  });

  it('flattens google_shopping_carousel items into individual product sources with URLs', async () => {
    process.env.DATAFORSEO_LOGIN = 'login';
    process.env.DATAFORSEO_PASSWORD = 'password';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [{ id: 'merchant_task_002', status_code: 20100 }],
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
                      type: 'google_shopping_carousel',
                      title: "Women's Luxury Shoes",
                      items: [
                        {
                          gid: 'carousel_prod_001',
                          product_id: 'catalog_001',
                          title: 'Italian Leather Pumps',
                          shopping_url: 'https://google.com/search?ibp=oshop&q=luxury+shoes&prds=gpcid:001',
                          product_images: ['https://api.dataforseo.com/cdn/i/shoe1:0'],
                          price: 299,
                          currency: 'USD',
                          product_rating: { type: 'rating_element', value: 4.7, rating_max: 5, votes_count: 85 },
                          seller: 'Luxury Boutique',
                        },
                        {
                          gid: 'carousel_prod_002',
                          product_id: 'catalog_002',
                          title: 'Designer Stiletto Heels',
                          shopping_url: 'https://google.com/search?ibp=oshop&q=luxury+shoes&prds=gpcid:002',
                          product_images: ['https://api.dataforseo.com/cdn/i/shoe2:0'],
                          price: 349,
                          currency: 'USD',
                          product_rating: { type: 'rating_element', value: 4.5, rating_max: 5, votes_count: 42 },
                          seller: 'Designer Co',
                        },
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

    const provider = new DataForSeoMerchantProvider(0, 1);
    const result = await provider.collect(input);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({
        type: 'MARKETPLACE',
        provider: 'DataForSEO Merchant Google Products',
        title: 'Italian Leather Pumps',
        url: 'https://google.com/search?ibp=oshop&q=luxury+shoes&prds=gpcid:001',
        externalId: 'catalog_001',
        confidence: 0.78,
      }),
    );
    expect(result[1]).toEqual(
      expect.objectContaining({
        type: 'MARKETPLACE',
        provider: 'DataForSEO Merchant Google Products',
        title: 'Designer Stiletto Heels',
        url: 'https://google.com/search?ibp=oshop&q=luxury+shoes&prds=gpcid:002',
        externalId: 'catalog_002',
        confidence: 0.78,
      }),
    );
    // Carousel container title should NOT appear as a product
    const titles = result.map((r) => r.title);
    expect(titles).not.toContain("Women's Luxury Shoes");
  });
});
