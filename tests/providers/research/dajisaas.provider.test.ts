/**
 * Purpose:
 * Contract-focused tests for the DajiSaaS 1688 sourcing adapter.
 *
 * Responsibilities:
 * - Verify documented GET endpoints and MD5 query signing
 * - Verify DajiSaaS response envelopes and product-detail enrichment
 * - Verify CNY preservation and explicit USD conversion
 * - Verify malformed or failed responses return no fabricated evidence
 *
 * Dependencies:
 * - vitest
 * - DajiSaasProvider
 */

import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DajiSaasProvider } from '@/providers/research';
import type { ResearchProviderCollectInput } from '@/types/research.types';

const input: ResearchProviderCollectInput = {
  productIdea: '便携式榨汁机',
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

function searchResponse(
  items: unknown[] = [
    {
      offerId: 769649076522,
      imageUrl: 'https://cbu01.alicdn.com/example.jpg',
      subject: '便携式榨汁机厂家直供',
      subjectTrans: 'Portable blender factory supply',
      priceInfo: { price: '20.00', consignPrice: '22.00' },
      repurchaseRate: '25%',
      monthSold: 1200,
      isOnePsale: true,
      sellerIdentities: ['tp_member'],
    },
  ],
) {
  return {
    ok: true,
    json: async () => ({
      code: 200,
      message: '操作成功',
      data: {
        totalRecords: items.length,
        totalPage: 1,
        pageSize: 10,
        currentPage: 1,
        data: items,
      },
      timestamp: 1720000000000,
      traceId: 'trace-search',
    }),
  };
}

function detailResponse() {
  return {
    ok: true,
    json: async () => ({
      code: 200,
      message: '操作成功',
      data: {
        offerId: 769649076522,
        subject: '便携式榨汁机厂家直供',
        subjectTrans: 'Portable blender factory supply',
        minOrderQuantity: 2,
        productImage: { images: ['https://cbu01.alicdn.com/detail.jpg'] },
        productSaleInfo: {
          amountOnSale: 500,
          quoteType: 0,
          priceRangeList: [
            { startQuantity: 2, price: '20.00', promotionPrice: '19.00' },
            { startQuantity: 100, price: '18.00', promotionPrice: '17.00' },
          ],
        },
        productShippingInfo: {
          sendGoodsAddressText: '广东省深圳市',
          shippingTimeGuarantee: '48小时发货',
        },
        sellerOpenId: 'seller-open-id',
        soldOut: 5000,
      },
      timestamp: 1720000000001,
      traceId: 'trace-detail',
    }),
  };
}

describe('DajiSaasProvider', () => {
  beforeEach(() => {
    process.env.SOURCING_1688_DAJISAAS_API_KEY = 'dj_test_key';
    process.env.SOURCING_1688_DAJISAAS_API_SECRET = 'dj_test_secret';
    process.env.SOURCING_1688_DAJISAAS_ENDPOINT = 'https://openapi.dajisaas.com';
    process.env.SOURCING_1688_DAJISAAS_COUNTRY = 'en';
    process.env.SOURCING_1688_CNY_TO_USD_RATE = '0.14';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SOURCING_1688_DAJISAAS_API_KEY;
    delete process.env.SOURCING_1688_DAJISAAS_API_SECRET;
    delete process.env.SOURCING_1688_DAJISAAS_ENDPOINT;
    delete process.env.SOURCING_1688_DAJISAAS_COUNTRY;
    delete process.env.SOURCING_1688_CNY_TO_USD_RATE;
  });

  it('does not call DajiSaaS when credentials are missing', async () => {
    delete process.env.SOURCING_1688_DAJISAAS_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await new DajiSaasProvider().collect(input)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses documented GET endpoints and MD5-signed query parameters', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(searchResponse())
      .mockResolvedValueOnce(detailResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await new DajiSaasProvider().collect(input);

    expect(result).toHaveLength(1);
    const searchUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(searchUrl.pathname).toBe('/alibaba/product/keywordQuery');
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) }),
    );
    expect(searchUrl.searchParams.get('appKey')).toBe('dj_test_key');
    expect(searchUrl.searchParams.get('keyword')).toBe(input.productIdea);
    expect(searchUrl.searchParams.has('appSecret')).toBe(false);

    const parameters = [...searchUrl.searchParams.entries()]
      .filter(([key]) => key !== 'sign')
      .sort(([left], [right]) => left.localeCompare(right));
    const signingString = parameters.map(([key, value]) => `${key}=${value}`).join('&');
    const expectedSign = createHash('md5')
      .update(`${signingString}&secret=dj_test_secret`)
      .digest('hex')
      .toUpperCase();
    expect(searchUrl.searchParams.get('sign')).toBe(expectedSign);

    const detailUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(detailUrl.pathname).toBe('/alibaba/product/queryProductDetail');
    expect(detailUrl.searchParams.get('offerId')).toBe('769649076522');
  });

  it('preserves CNY payload and converts normalized costs to USD explicitly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(searchResponse()).mockResolvedValueOnce(detailResponse()),
    );

    const [source] = await new DajiSaasProvider().collect(input);
    expect(source).toEqual(
      expect.objectContaining({
        type: 'SOURCING',
        provider: 'dajiSaas',
        externalId: '769649076522',
        confidence: 0.8,
        rawData: expect.objectContaining({
          sourceCurrency: 'CNY',
          sourcePriceCny: 20,
          conversionRate: 0.14,
          sourceTieredPricesCny: [
            { minQuantity: 2, unitCost: 20 },
            { minQuantity: 100, unitCost: 18 },
          ],
          metrics: expect.objectContaining({
            factoryUnitCost: 2.8,
            productCost: 2.8,
            moq: 2,
          }),
        }),
      }),
    );
  });

  it('keeps CNY evidence but omits USD cost when exchange rate is missing', async () => {
    delete process.env.SOURCING_1688_CNY_TO_USD_RATE;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(searchResponse()).mockResolvedValueOnce(detailResponse()),
    );

    const [source] = await new DajiSaasProvider().collect(input);
    const rawData = source?.rawData as Record<string, unknown>;
    const metrics = rawData.metrics as Record<string, unknown>;
    expect(rawData.sourcePriceCny).toBe(20);
    expect(metrics.factoryUnitCost).toBeUndefined();
  });

  it('returns no evidence for malformed search envelopes or HTTP failures', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 200, data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await new DajiSaasProvider().collect(input)).toEqual([]);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    expect(await new DajiSaasProvider().collect(input)).toEqual([]);
  });
});
