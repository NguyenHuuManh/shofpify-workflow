/**
 * Purpose:
 * Unit tests for supplemental search research provider.
 *
 * Responsibilities:
 * - Verify missing credentials do not fabricate evidence
 * - Verify approved API responses are normalized into ResearchSource payloads
 *
 * Dependencies:
 * - vitest
 * - SearchResearchProvider
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchResearchProvider } from '@/providers/research';
import type { ResearchProviderCollectInput } from '@/types/research.types';

const input: ResearchProviderCollectInput = {
  productIdea: 'portable blender',
  config: {
    targetMarket: 'US',
    targetMarginPercent: 40,
    riskTolerance: 'medium',
    excludedCategories: [],
    objective: 'find_winning_product',
    supplementalProviders: ['search'],
  },
  candidates: [],
};

describe('SearchResearchProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DATAFORSEO_LOGIN;
    delete process.env.DATAFORSEO_PASSWORD;
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.SERPAPI_API_KEY;
  });

  it('returns no evidence when credentials are missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new SearchResearchProvider();
    const result = await provider.collect(input);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes Brave Search web results into SEARCH sources', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'brave_test_key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            {
              title: 'Best portable blender comparison',
              url: 'https://example.com/blender-review',
              description: 'Compares battery life, portability, and common leakage complaints.',
            },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new SearchResearchProvider();
    const result = await provider.collect(input);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        type: 'SEARCH',
        provider: 'Brave Search',
        url: 'https://example.com/blender-review',
        title: 'Best portable blender comparison',
        extractedSignal: expect.stringContaining('battery life'),
      }),
    );
  });

  it('prefers DataForSEO organic SERP when DataForSEO credentials are configured', async () => {
    process.env.DATAFORSEO_LOGIN = 'login';
    process.env.DATAFORSEO_PASSWORD = 'password';
    process.env.BRAVE_SEARCH_API_KEY = 'brave_test_key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tasks: [
          {
            result: [
              {
                items: [
                  {
                    title: 'Portable blender competitor guide',
                    url: 'https://example.com/dataforseo-result',
                    description: 'Competitor page discusses weak motors and leaking lids.',
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new SearchResearchProvider();
    const result = await provider.collect(input);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        provider: 'DataForSEO Google Organic SERP',
        url: 'https://example.com/dataforseo-result',
        extractedSignal: expect.stringContaining('weak motors'),
      }),
    );
  });
});
