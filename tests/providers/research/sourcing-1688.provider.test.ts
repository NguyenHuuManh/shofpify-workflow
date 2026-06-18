/**
 * Purpose:
 * Unit tests for 1688 sourcing research provider.
 *
 * Responsibilities:
 * - Verify 1688 responses normalize into SOURCING evidence
 * - Preserve MOQ, tiered prices, factory cost, and sourcing metrics
 *
 * Dependencies:
 * - vitest
 * - Sourcing1688ResearchProvider
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sourcing1688ResearchProvider } from '@/providers/research';
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
    supplementalProviders: ['sourcing'],
  },
  candidates: [],
};

describe('Sourcing1688ResearchProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SOURCING_1688_PROVIDER;
    delete process.env.SOURCING_1688_API_KEY;
    delete process.env.SOURCING_1688_ENDPOINT;
  });

  it('returns no evidence when 1688 credentials are missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Sourcing1688ResearchProvider();
    const result = await provider.collect(input);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes 1688 sourcing listings into SOURCING sources with metrics', async () => {
    process.env.SOURCING_1688_API_KEY = '1688_test_key';
    process.env.SOURCING_1688_ENDPOINT = 'https://example.com/1688-search';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            offerId: 'offer_001',
            title: 'USB Portable Blender Factory Listing',
            url: 'https://detail.1688.com/offer/offer_001.html',
            shopName: 'Guangdong Blender Factory',
            location: 'Guangdong',
            moq: 100,
            price: '22.50',
            domesticChinaShipping: 2.5,
            leadTime: '3-7 days',
            tieredPrices: [
              { minQuantity: 2, unitCost: 25 },
              { minQuantity: 100, unitCost: 22.5 },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Sourcing1688ResearchProvider();
    const result = await provider.collect(input);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://example.com/1688-search?q=portable+blender'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer 1688_test_key',
        }),
      }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        type: 'SOURCING',
        provider: '1688',
        url: 'https://detail.1688.com/offer/offer_001.html',
        externalId: 'offer_001',
        extractedSignal: expect.stringContaining('MOQ 100'),
        rawData: expect.objectContaining({
          sourcePlatform: '1688',
          offerId: 'offer_001',
          moq: 100,
          tieredPrices: [
            { minQuantity: 2, unitCost: 25 },
            { minQuantity: 100, unitCost: 22.5 },
          ],
          metrics: expect.objectContaining({
            productCost: 22.5,
            factoryUnitCost: 22.5,
            shippingCost: 2.5,
            moq: 100,
            sourcingSignal: expect.any(Number),
            factoryCostSignal: expect.any(Number),
            logisticsSignal: expect.any(Number),
          }),
        }),
      }),
    );
  });
});
