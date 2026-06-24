/**
 * Purpose:
 * Unit tests for Apify 1688 sourcing provider adapter.
 *
 * Responsibilities:
 * - Verify actor run lifecycle (start → poll → fetch dataset)
 * - Verify dataset items are normalized into SOURCING evidence
 * - Verify empty evidence on missing credentials, run failures, timeouts
 * - Verify Apify is never called when not configured
 *
 * Dependencies:
 * - vitest
 * - Apify1688Provider
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Apify1688Provider } from '@/providers/research';
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
    supplementalProviders: ['sourcing'],
  },
  candidates: [],
};

function apifyRunResponse(runId = 'run_abc123', status = 'SUCCEEDED') {
  return {
    ok: true,
    json: async () => ({
      data: { id: runId, status },
    }),
  };
}

function apifyDatasetItems(overrides?: unknown[]) {
  if (overrides !== undefined) {
    return {
      ok: true,
      json: async () => overrides,
    };
  }

  return {
    ok: true,
    json: async () => [
      {
        offerId: 'offer_apify_001',
        title: 'Portable Blender 1688 Apify',
        url: 'https://detail.1688.com/offer/offer_apify_001.html',
        shopName: 'Shenzhen Electronics Co',
        location: 'Shenzhen',
        moq: 200,
        price: 19.8,
        domesticChinaShipping: 3.0,
        leadTime: '5-10 days',
        tieredPrices: [
          { minQuantity: 50, unitCost: 21 },
          { minQuantity: 200, unitCost: 19.8 },
        ],
      },
    ],
  };
}

describe('Apify1688Provider', () => {
  beforeEach(() => {
    process.env.SOURCING_1688_APIFY_API_TOKEN = 'apify_test_token';
    process.env.SOURCING_1688_APIFY_ACTOR_ID = 'test_actor_1688';
    process.env.SOURCING_1688_CNY_TO_USD_RATE = '0.14';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SOURCING_1688_APIFY_API_TOKEN;
    delete process.env.SOURCING_1688_APIFY_ACTOR_ID;
    delete process.env.SOURCING_1688_CNY_TO_USD_RATE;
  });

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  it('returns isConfigured=false when credentials are missing', () => {
    delete process.env.SOURCING_1688_APIFY_API_TOKEN;
    const provider = new Apify1688Provider(0);
    expect(provider.isConfigured()).toBe(false);
  });

  it('returns isConfigured=true when credentials are set', () => {
    const provider = new Apify1688Provider(0);
    expect(provider.isConfigured()).toBe(true);
  });

  it('returns no evidence when not configured', async () => {
    delete process.env.SOURCING_1688_APIFY_API_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Full lifecycle — Success
  // ---------------------------------------------------------------------------

  it('starts run, polls until SUCCEEDED, fetches dataset, normalizes SOURCING evidence', async () => {
    const fetchMock = vi
      .fn()
      // 1. Start run
      .mockResolvedValueOnce(apifyRunResponse('run_abc123', 'RUNNING'))
      // 2. Poll status — RUNNING
      .mockResolvedValueOnce(apifyRunResponse('run_abc123', 'RUNNING'))
      // 3. Poll status — SUCCEEDED
      .mockResolvedValueOnce(apifyRunResponse('run_abc123', 'SUCCEEDED'))
      // 4. Fetch dataset
      .mockResolvedValueOnce(apifyDatasetItems());
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result.length).toBe(1);
    expect(result[0]!).toEqual(
      expect.objectContaining({
        type: 'SOURCING',
        provider: 'apify',
        url: 'https://detail.1688.com/offer/offer_apify_001.html',
        externalId: 'offer_apify_001',
        title: 'Portable Blender 1688 Apify',
        confidence: 0.7,
        rawData: expect.objectContaining({
          sourcePlatform: '1688',
          sourceVendor: 'apify',
          metrics: expect.objectContaining({
            factoryUnitCost: 2.77,
            moq: 200,
            shippingCost: 0.42,
            sourcingSignal: expect.any(Number),
            factoryCostSignal: expect.any(Number),
            logisticsSignal: expect.any(Number),
          }),
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/actor-runs/run_abc123');
    expect(String(fetchMock.mock.calls[3]?.[0])).toContain('/actor-runs/run_abc123/dataset/items');
  });

  it('normalizes the production actor price, supplier, tier, and shipping shapes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apifyRunResponse('run_production', 'RUNNING'))
      .mockResolvedValueOnce(apifyRunResponse('run_production', 'SUCCEEDED'))
      .mockResolvedValueOnce(
        apifyDatasetItems([
          {
            offerId: '755327424370',
            title: 'American Style Heavy Shoulder Round Neck Blank White TShirt',
            detailUrl: 'https://detail.1688.com/offer/755327424370.html',
            price: { min: 18, max: 20, currency: 'CNY', priceType: 'NORMAL' },
            minOrderQuantity: 1,
            quantityPrices: [
              { quantityMin: 1, quantityMax: 49, price: 20 },
              { quantityMin: 50, quantityMax: 99, price: 19 },
              { quantityMin: 100, quantityMax: null, price: 18 },
            ],
            supplier: {
              companyName: 'Su Ning Gao Can Knitting Factory',
              shopUrl: 'http://songermao2010.1688.com',
            },
            province: 'Hebei',
            city: 'Cangzhou',
            shipping: { deliveryHours: 48, deliveryDays: 2, postFee: 4 },
          },
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        provider: 'apify',
        url: 'https://detail.1688.com/offer/755327424370.html',
        rawData: expect.objectContaining({
          shopName: 'Su Ning Gao Can Knitting Factory',
          sourcePriceCny: 18,
          sourceDomesticChinaShippingCny: 4,
          moq: 1,
          tieredPrices: [
            { minQuantity: 1, unitCost: 2.8 },
            { minQuantity: 50, unitCost: 2.66 },
            { minQuantity: 100, unitCost: 2.52 },
          ],
          metrics: expect.objectContaining({
            factoryUnitCost: 2.52,
            shippingCost: 0.56,
            moq: 1,
          }),
        }),
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // Run lifecycle — Failure cases
  // ---------------------------------------------------------------------------

  it('returns empty array when start run fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result).toEqual([]);
  });

  it('returns empty array when run status is FAILED', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apifyRunResponse('run_fail', 'RUNNING'))
      .mockResolvedValueOnce(apifyRunResponse('run_fail', 'FAILED'));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result).toEqual([]);
  });

  it('returns empty array when run status is ABORTED', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apifyRunResponse('run_abort', 'RUNNING'))
      .mockResolvedValueOnce(apifyRunResponse('run_abort', 'ABORTED'));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result).toEqual([]);
  });

  it('returns empty array when run status is TIMED-OUT', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apifyRunResponse('run_timeout', 'RUNNING'))
      .mockResolvedValueOnce(apifyRunResponse('run_timeout', 'TIMED-OUT'));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result).toEqual([]);
  });

  it('returns empty array when start run response has no run ID', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Dataset — Failure cases
  // ---------------------------------------------------------------------------

  it('returns empty array when dataset fetch fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apifyRunResponse('run_good', 'RUNNING'))
      .mockResolvedValueOnce(apifyRunResponse('run_good', 'SUCCEEDED'))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal error',
      });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result).toEqual([]);
  });

  it('returns empty array when dataset is empty', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apifyRunResponse('run_empty', 'RUNNING'))
      .mockResolvedValueOnce(apifyRunResponse('run_empty', 'SUCCEEDED'))
      .mockResolvedValueOnce(apifyDatasetItems([]));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result).toEqual([]);
  });

  it('returns empty array when dataset response is not an array', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apifyRunResponse('run_bad', 'RUNNING'))
      .mockResolvedValueOnce(apifyRunResponse('run_bad', 'SUCCEEDED'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: 'not-an-array' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Normalization edge cases
  // ---------------------------------------------------------------------------

  it('handles minimal dataset items gracefully', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apifyRunResponse('run_min', 'RUNNING'))
      .mockResolvedValueOnce(apifyRunResponse('run_min', 'SUCCEEDED'))
      .mockResolvedValueOnce(
        apifyDatasetItems([
          {
            id: 'min_apify_001',
            title: 'Minimal Apify Product',
          },
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result.length).toBe(1);
    expect(result[0]!.externalId).toBe('min_apify_001');
    expect(result[0]!.title).toBe('Minimal Apify Product');
  });

  // ---------------------------------------------------------------------------
  // Network exceptions
  // ---------------------------------------------------------------------------

  it('returns empty array on network exception during start run', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ENOTFOUND'));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result).toEqual([]);
  });

  it('returns empty array on network exception during status poll', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apifyRunResponse('run_net', 'RUNNING'))
      .mockRejectedValueOnce(new Error('ECONNRESET'));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new Apify1688Provider(0);
    const result = await provider.collect(input);

    expect(result).toEqual([]);
  });
});
