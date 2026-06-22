/**
 * Purpose:
 * Unit tests for 1688 sourcing failover orchestrator.
 *
 * Responsibilities:
 * - Verify DajiSaaS primary → success returns DajiSaaS evidence
 * - Verify DajiSaaS primary → empty → Apify backup → success returns Apify evidence
 * - Verify DajiSaaS primary → empty → Apify backup → empty returns empty
 * - Verify both unconfigured returns empty with no AI fallback
 * - Verify vendor provenance is preserved (dajiSaas vs apify)
 * - Verify no parallel calls, no merged results
 *
 * Dependencies:
 * - vitest
 * - Sourcing1688ResearchProvider
 * - DajiSaasProvider
 * - Apify1688Provider
 */

import { describe, expect, it, vi } from 'vitest';
import {
  Sourcing1688ResearchProvider,
  DajiSaasProvider,
  Apify1688Provider,
} from '@/providers/research';
import type { ResearchProviderCollectInput } from '@/types/research.types';
import type { NormalizedResearchSourceInput } from '@/schemas/research.schema';

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

function makeSource(vendor: 'dajiSaas' | 'apify', index = 0): NormalizedResearchSourceInput {
  return {
    type: 'SOURCING',
    provider: vendor,
    url: `https://detail.1688.com/offer/${vendor}_${index}.html`,
    externalId: `${vendor}_offer_${index}`,
    title: `${vendor === 'dajiSaas' ? 'DajiSaaS' : 'Apify'} Product ${index}`,
    extractedSignal: `${vendor} sourcing evidence for portable blender`,
    rawData: {
      sourcePlatform: '1688',
      sourceVendor: vendor,
      metrics: {
        productCost: 22.5,
        factoryUnitCost: 22.5,
        moq: 100,
      },
    },
    confidence: vendor === 'dajiSaas' ? 0.76 : 0.7,
    capturedAt: new Date(),
  };
}

describe('Sourcing1688ResearchProvider — Failover Orchestrator', () => {
  // ---------------------------------------------------------------------------
  // DajiSaaS primary success (no Apify call)
  // ---------------------------------------------------------------------------

  it('returns DajiSaaS evidence when primary succeeds — Apify never called', async () => {
    const mockDajiSaas = {
      vendor: 'dajiSaas' as const,
      name: 'DajiSaasProvider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn().mockResolvedValue([makeSource('dajiSaas', 0), makeSource('dajiSaas', 1)]),
    };

    const mockApify = {
      vendor: 'apify' as const,
      name: 'Apify1688Provider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn(),
    };

    const orchestrator = new Sourcing1688ResearchProvider(
      mockDajiSaas as unknown as DajiSaasProvider,
      mockApify as unknown as Apify1688Provider,
    );

    const result = await orchestrator.collectWithFailover(input);

    expect(result.sources).toHaveLength(2);
    expect(result.selectedVendor).toBe('dajiSaas');
    expect(result.failoverReason).toBeNull();
    expect(result.sources[0]!.provider).toBe('dajiSaas');
    expect(mockDajiSaas.collect).toHaveBeenCalledTimes(1);
    expect(mockApify.collect).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // DajiSaaS empty → Apify success
  // ---------------------------------------------------------------------------

  it('falls back to Apify when DajiSaaS returns empty evidence', async () => {
    const mockDajiSaas = {
      vendor: 'dajiSaas' as const,
      name: 'DajiSaasProvider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn().mockResolvedValue([]),
    };

    const mockApify = {
      vendor: 'apify' as const,
      name: 'Apify1688Provider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn().mockResolvedValue([makeSource('apify', 0)]),
    };

    const orchestrator = new Sourcing1688ResearchProvider(
      mockDajiSaas as unknown as DajiSaasProvider,
      mockApify as unknown as Apify1688Provider,
    );

    const result = await orchestrator.collectWithFailover(input);

    expect(result.sources).toHaveLength(1);
    expect(result.selectedVendor).toBe('apify');
    expect(result.failoverReason).toBe('dajiSaas_unavailable_or_no_evidence');
    expect(result.sources[0]!.provider).toBe('apify');
    expect(mockDajiSaas.collect).toHaveBeenCalledTimes(1);
    expect(mockApify.collect).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // DajiSaaS not configured → Apify success
  // ---------------------------------------------------------------------------

  it('skips to Apify when DajiSaaS is not configured', async () => {
    const mockDajiSaas = {
      vendor: 'dajiSaas' as const,
      name: 'DajiSaasProvider',
      isConfigured: vi.fn().mockReturnValue(false),
      collect: vi.fn(),
    };

    const mockApify = {
      vendor: 'apify' as const,
      name: 'Apify1688Provider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn().mockResolvedValue([makeSource('apify', 0)]),
    };

    const orchestrator = new Sourcing1688ResearchProvider(
      mockDajiSaas as unknown as DajiSaasProvider,
      mockApify as unknown as Apify1688Provider,
    );

    const result = await orchestrator.collectWithFailover(input);

    expect(result.sources).toHaveLength(1);
    expect(result.selectedVendor).toBe('apify');
    expect(mockDajiSaas.collect).not.toHaveBeenCalled();
    expect(mockApify.collect).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Both fail — no AI fallback
  // ---------------------------------------------------------------------------

  it('returns empty when both DajiSaaS and Apify return empty evidence', async () => {
    const mockDajiSaas = {
      vendor: 'dajiSaas' as const,
      name: 'DajiSaasProvider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn().mockResolvedValue([]),
    };

    const mockApify = {
      vendor: 'apify' as const,
      name: 'Apify1688Provider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn().mockResolvedValue([]),
    };

    const orchestrator = new Sourcing1688ResearchProvider(
      mockDajiSaas as unknown as DajiSaasProvider,
      mockApify as unknown as Apify1688Provider,
    );

    const result = await orchestrator.collectWithFailover(input);

    expect(result.sources).toEqual([]);
    expect(result.selectedVendor).toBeNull();
    expect(result.failoverReason).toBe('both_vendors_unavailable_or_no_evidence');
    expect(mockDajiSaas.collect).toHaveBeenCalledTimes(1);
    expect(mockApify.collect).toHaveBeenCalledTimes(1);
  });

  it('returns empty when neither vendor is configured', async () => {
    const mockDajiSaas = {
      vendor: 'dajiSaas' as const,
      name: 'DajiSaasProvider',
      isConfigured: vi.fn().mockReturnValue(false),
      collect: vi.fn(),
    };

    const mockApify = {
      vendor: 'apify' as const,
      name: 'Apify1688Provider',
      isConfigured: vi.fn().mockReturnValue(false),
      collect: vi.fn(),
    };

    const orchestrator = new Sourcing1688ResearchProvider(
      mockDajiSaas as unknown as DajiSaasProvider,
      mockApify as unknown as Apify1688Provider,
    );

    const result = await orchestrator.collectWithFailover(input);

    expect(result.sources).toEqual([]);
    expect(result.selectedVendor).toBeNull();
    expect(result.failoverReason).toBe('both_vendors_unavailable_or_no_evidence');
    expect(mockDajiSaas.collect).not.toHaveBeenCalled();
    expect(mockApify.collect).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // collect() method (ResearchProvider contract)
  // ---------------------------------------------------------------------------

  it('collect() returns sources from failover orchestrator', async () => {
    const mockDajiSaas = {
      vendor: 'dajiSaas' as const,
      name: 'DajiSaasProvider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn().mockResolvedValue([makeSource('dajiSaas', 0)]),
    };

    const mockApify = {
      vendor: 'apify' as const,
      name: 'Apify1688Provider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn(),
    };

    const orchestrator = new Sourcing1688ResearchProvider(
      mockDajiSaas as unknown as DajiSaasProvider,
      mockApify as unknown as Apify1688Provider,
    );

    const sources = await orchestrator.collect(input);

    expect(sources).toHaveLength(1);
    expect(sources[0]!.provider).toBe('dajiSaas');
  });

  it('does not call either vendor when sourcing is disabled', async () => {
    const mockDajiSaas = {
      vendor: 'dajiSaas' as const,
      name: 'DajiSaasProvider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn(),
    };
    const mockApify = {
      vendor: 'apify' as const,
      name: 'Apify1688Provider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn(),
    };
    const orchestrator = new Sourcing1688ResearchProvider(mockDajiSaas, mockApify);

    const result = await orchestrator.collectWithFailover({
      ...input,
      config: { ...input.config, supplementalProviders: ['search'] },
    });

    expect(result.failoverReason).toBe('sourcing_disabled');
    expect(mockDajiSaas.collect).not.toHaveBeenCalled();
    expect(mockApify.collect).not.toHaveBeenCalled();
  });

  it('falls back when primary returns structurally valid but unusable evidence', async () => {
    const unusable: NormalizedResearchSourceInput = {
      type: 'SOURCING',
      provider: 'dajiSaas',
      title: 'Empty listing',
      extractedSignal: 'No sourcing metrics',
      rawData: {},
      capturedAt: new Date(),
    };
    const mockDajiSaas = {
      vendor: 'dajiSaas' as const,
      name: 'DajiSaasProvider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn().mockResolvedValue([unusable]),
    };
    const mockApify = {
      vendor: 'apify' as const,
      name: 'Apify1688Provider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn().mockResolvedValue([makeSource('apify')]),
    };
    const orchestrator = new Sourcing1688ResearchProvider(mockDajiSaas, mockApify);

    const result = await orchestrator.collectWithFailover(input);

    expect(result.selectedVendor).toBe('apify');
    expect(mockApify.collect).toHaveBeenCalledTimes(1);
  });

  it('falls back when the primary adapter throws', async () => {
    const mockDajiSaas = {
      vendor: 'dajiSaas' as const,
      name: 'DajiSaasProvider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn().mockRejectedValue(new Error('primary failed')),
    };
    const mockApify = {
      vendor: 'apify' as const,
      name: 'Apify1688Provider',
      isConfigured: vi.fn().mockReturnValue(true),
      collect: vi.fn().mockResolvedValue([makeSource('apify')]),
    };
    const orchestrator = new Sourcing1688ResearchProvider(mockDajiSaas, mockApify);

    const result = await orchestrator.collectWithFailover(input);

    expect(result.selectedVendor).toBe('apify');
  });
});
