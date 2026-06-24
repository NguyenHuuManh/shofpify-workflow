/**
 * Purpose:
 * Unit tests for ProductAggregationService.
 *
 * Responsibilities:
 * - Verify AI grouping uses only provider-backed source keys
 * - Verify deterministic fallback grouping and metric merging
 * - Verify SOURCING evidence cannot seed discovery groups
 *
 * Dependencies:
 * - vitest
 * - ProductAggregationService
 */

import { describe, expect, it, vi } from 'vitest';
import { ProductAggregationService } from '@/services/product-aggregation.service';
import type { AIProvider } from '@/types/ai-provider.interface';
import type { NormalizedResearchSourceInput } from '@/schemas/research.schema';

const marketplaceSources: NormalizedResearchSourceInput[] = [
  {
    type: 'MARKETPLACE',
    provider: 'Apify Google Shopping',
    url: 'https://example.com/blender-a',
    externalId: 'listing_a',
    title: 'USB Portable Blender',
    extractedSignal: 'USB Portable Blender listing, 1200 reviews',
    rawData: {
      metrics: {
        price: 39.99,
        rating: 4.6,
        reviewCount: 1200,
        demandSignal: 82,
      },
      apifyActorId: 'epctex/google-shopping-scraper',
    },
    confidence: 0.74,
    capturedAt: new Date('2026-01-01'),
  },
  {
    type: 'MARKETPLACE',
    provider: 'Apify Amazon Product Scraper',
    url: 'https://example.com/blender-b',
    externalId: 'listing_b',
    title: 'USB Portable Blender - Travel Smoothie Maker',
    extractedSignal: 'Travel smoothie maker, 800 reviews',
    rawData: {
      metrics: {
        price: 42.99,
        rating: 4.4,
        reviewCount: 800,
        demandSignal: 78,
      },
      apifyActorId: 'junglee/amazon-crawler',
    },
    confidence: 0.71,
    capturedAt: new Date('2026-01-01'),
  },
];

function aiProviderWithText(text: string): AIProvider {
  return {
    providerName: 'test-ai',
    generateText: vi.fn().mockResolvedValue({
      text,
      model: 'test-model',
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
      },
    }),
  };
}

describe('ProductAggregationService', () => {
  it('groups marketplace listings with AI and merges metrics', async () => {
    const service = new ProductAggregationService();
    const prepared = marketplaceSources.map((source, index) => service.sourceKey(source, index));
    const aiProvider = aiProviderWithText(
      JSON.stringify({
        groups: [
          {
            name: 'USB Portable Blender',
            sourceKeys: prepared,
            rationale: 'Both listings describe the same USB portable blender product.',
          },
        ],
      }),
    );

    const result = await service.aggregate(
      {
        productIdea: 'portable blender',
        sources: marketplaceSources,
        maxGroups: 5,
      },
      aiProvider,
    );

    expect(aiProvider.generateText).toHaveBeenCalledOnce();
    expect(result.method).toBe('ai_grouping');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toEqual(
      expect.objectContaining({
        name: 'USB Portable Blender',
        method: 'ai_grouping',
        sourceKeys: prepared,
        mergedMetrics: expect.objectContaining({
          medianPrice: 41.49,
          minPrice: 39.99,
          maxPrice: 42.99,
          ratingAverage: 4.5,
          reviewCountTotal: 2000,
          demandSignal: 82,
          sourceCount: 2,
        }),
      }),
    );
  });

  it('falls back to deterministic dedup when AI output is invalid', async () => {
    const service = new ProductAggregationService();
    const aiProvider = aiProviderWithText('not json');

    const result = await service.aggregate(
      {
        productIdea: 'portable blender',
        sources: marketplaceSources,
        maxGroups: 5,
      },
      aiProvider,
    );

    expect(result.method).toBe('deterministic_dedup');
    expect(result.groups.length).toBeGreaterThan(0);
    expect(result.groups.every((group) => group.method === 'deterministic_dedup')).toBe(true);
  });

  it('ignores sourcing evidence during initial aggregation', async () => {
    const service = new ProductAggregationService();
    const result = await service.aggregate({
      productIdea: 'portable blender',
      sources: [
        {
          type: 'SOURCING',
          provider: '1688',
          url: 'https://detail.1688.com/offer/123.html',
          externalId: '123',
          title: 'Factory Portable Blender',
          extractedSignal: '1688 offer with MOQ and factory unit cost',
          rawData: {
            metrics: {
              productCost: 12,
              moq: 100,
            },
          },
          confidence: 0.8,
          capturedAt: new Date('2026-01-01'),
        },
      ],
      maxGroups: 5,
    });

    expect(result.groups).toEqual([]);
    expect(result.sources).toEqual([]);
  });

  it('respects the configured group limit', async () => {
    const service = new ProductAggregationService();
    const chopperSource: NormalizedResearchSourceInput = {
      type: 'MARKETPLACE',
      provider: 'Apify Etsy Data Extractor',
      url: 'https://example.com/chopper',
      externalId: 'listing_c',
      title: 'Manual Vegetable Chopper',
      extractedSignal: 'Manual Vegetable Chopper listing, 500 reviews',
      rawData: {
        metrics: {
          price: 24.99,
          reviewCount: 500,
        },
      },
      confidence: 0.7,
      capturedAt: new Date('2026-01-01'),
    };
    const result = await service.aggregate({
      productIdea: 'kitchen gadgets',
      sources: [
        ...marketplaceSources,
        chopperSource,
      ],
      maxGroups: 1,
    });

    expect(result.groups).toHaveLength(1);
  });
});
