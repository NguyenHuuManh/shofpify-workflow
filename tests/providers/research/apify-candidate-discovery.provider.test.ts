/**
 * Purpose:
 * Unit tests for Apify candidate discovery provider.
 *
 * Responsibilities:
 * - Verify configured Apify actors run through start, poll, and dataset fetch
 * - Verify dataset items normalize into MARKETPLACE source evidence
 * - Verify missing configuration returns empty evidence without external calls
 *
 * Dependencies:
 * - vitest
 * - ApifyCandidateDiscoveryProvider
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApifyCandidateDiscoveryProvider } from '@/providers/research';
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
};

let tempDir: string | undefined;

function writeActorConfigFile(configs: unknown[]): string {
  tempDir ??= mkdtempSync(join(tmpdir(), 'apify-candidate-config-'));
  const configPath = join(tempDir, `actors-${Date.now()}-${Math.random()}.json`);
  writeFileSync(configPath, JSON.stringify(configs));
  return configPath;
}

function apifyRunResponse(runId = 'run_candidate_001', status = 'SUCCEEDED') {
  return {
    ok: true,
    json: async () => ({
      data: { id: runId, status },
    }),
  };
}

describe('ApifyCandidateDiscoveryProvider', () => {
  beforeEach(() => {
    process.env.APIFY_CANDIDATE_DISCOVERY_API_TOKEN = 'apify_candidate_test_token';
    process.env.APIFY_CANDIDATE_DISCOVERY_CONFIG_PATH = writeActorConfigFile([
      {
        actorId: 'epctex/google-shopping-scraper',
        label: 'Apify Google Shopping',
        sourceType: 'MARKETPLACE',
        providerType: 'marketplace',
        maxItems: 5,
        input: {
          queries: ['{{query}}'],
          maxItems: '{{maxItems}}',
          country: '{{targetMarket}}',
        },
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.APIFY_CANDIDATE_DISCOVERY_API_TOKEN;
    delete process.env.APIFY_CANDIDATE_DISCOVERY_CONFIG_PATH;
    delete process.env.APIFY_CANDIDATE_DISCOVERY_ENDPOINT;
    if (tempDir) {
      rmSync(tempDir, { force: true, recursive: true });
      tempDir = undefined;
    }
  });

  it('returns empty evidence when token or actor config is missing', async () => {
    delete process.env.APIFY_CANDIDATE_DISCOVERY_API_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ApifyCandidateDiscoveryProvider(0);
    const result = await provider.collect(input);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts configured actor, fetches dataset, and normalizes marketplace evidence', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apifyRunResponse('run_candidate_001', 'RUNNING'))
      .mockResolvedValueOnce(apifyRunResponse('run_candidate_001', 'SUCCEEDED'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            productId: 'shopping_001',
            title: 'USB Rechargeable Portable Blender',
            link: 'https://example.com/portable-blender',
            price: '$39.99',
            rating: 4.6,
            reviews: 1280,
            seller: 'Example Merchant',
          },
        ],
      });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ApifyCandidateDiscoveryProvider(0);
    const result = await provider.collect(input);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.apify.com/v2/acts/epctex%2Fgoogle-shopping-scraper/runs',
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      queries: ['portable blender'],
      maxItems: 5,
      country: 'US',
    });
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain(
      '/actor-runs/run_candidate_001/dataset/items?clean=true',
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        type: 'MARKETPLACE',
        provider: 'Apify Google Shopping',
        url: 'https://example.com/portable-blender',
        externalId: 'shopping_001',
        title: 'USB Rechargeable Portable Blender',
        extractedSignal: expect.stringContaining('1280 reviews'),
        rawData: expect.objectContaining({
          apifyActorId: 'epctex/google-shopping-scraper',
          metrics: expect.objectContaining({
            price: 39.99,
            rating: 4.6,
            reviewCount: 1280,
            demandSignal: expect.any(Number),
          }),
        }),
      }),
    );
  });

  it('loads actor configuration from a JSON file', async () => {
    process.env.APIFY_CANDIDATE_DISCOVERY_CONFIG_PATH = writeActorConfigFile([
      {
        actorId: 'apify/e-commerce-scraping-tool',
        label: 'Apify File Config',
        sourceType: 'MARKETPLACE',
        providerType: 'marketplace',
        maxItems: 3,
        input: {
          SearchEngineSearchKeyword: '{{query}}',
          searchUrl: 'https://example.com/search?q={{queryUrlEncoded}}',
          countryCode: '{{targetMarket}}',
          maxSearchEngineProducts: '{{maxItems}}',
        },
      },
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apifyRunResponse('run_candidate_002', 'RUNNING'))
      .mockResolvedValueOnce(apifyRunResponse('run_candidate_002', 'SUCCEEDED'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'file_config_001',
            title: 'Countertop Portable Blender',
            url: 'https://example.com/file-config-blender',
          },
        ],
      });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ApifyCandidateDiscoveryProvider(0);
    const result = await provider.collect(input);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.apify.com/v2/acts/apify%2Fe-commerce-scraping-tool/runs',
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      SearchEngineSearchKeyword: 'portable blender',
      searchUrl: 'https://example.com/search?q=portable%20blender',
      countryCode: 'US',
      maxSearchEngineProducts: 3,
    });
    expect(result[0]).toEqual(
      expect.objectContaining({
        provider: 'Apify File Config',
        externalId: 'file_config_001',
        title: 'Countertop Portable Blender',
      }),
    );
  });

  it('returns empty evidence when an actor run fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apifyRunResponse('run_candidate_001', 'RUNNING'))
      .mockResolvedValueOnce(apifyRunResponse('run_candidate_001', 'FAILED'));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ApifyCandidateDiscoveryProvider(0);
    const result = await provider.collect(input);

    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
