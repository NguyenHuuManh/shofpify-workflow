/**
 * Purpose:
 * 1688 factory sourcing research provider with sequential failover orchestration.
 * DajiSaaS is the PRIMARY vendor. Apify is the SEQUENTIAL BACKUP.
 *
 * Responsibilities:
 * - Try DajiSaaS first for 1688 keyword-search + product-detail evidence
 * - Only call Apify when DajiSaaS is unavailable, fails, times out, is
 *   rate-limited, fails validation, or returns no usable evidence
 * - Never call both vendors in parallel; never merge results during failover
 * - Log selected vendor, failover reason, and evidence count
 * - Return empty evidence when both vendors fail (no AI fallback)
 *
 * Dependencies:
 * - DajiSaasProvider (primary)
 * - Apify1688Provider (backup)
 * - logger
 */

import { logger } from '@/lib/logger';
import {
  normalizedResearchSourceSchema,
  type NormalizedResearchSourceInput,
} from '@/schemas/research.schema';
import type {
  ResearchProviderCollectInput,
  SourcingProviderAdapter,
  SourcingFailoverResult,
} from '@/types/research.types';
import { DajiSaasProvider } from './dajisaas.provider';
import { Apify1688Provider } from './apify-1688.provider';

export class Sourcing1688ResearchProvider {
  readonly name = 'Sourcing1688ResearchProvider';
  readonly providerType = 'sourcing' as const;

  private readonly dajiSaas: SourcingProviderAdapter;
  private readonly apify: SourcingProviderAdapter;

  constructor(dajiSaasProvider?: SourcingProviderAdapter, apifyProvider?: SourcingProviderAdapter) {
    this.dajiSaas = dajiSaasProvider ?? new DajiSaasProvider();
    this.apify = apifyProvider ?? new Apify1688Provider();
  }

  // ---------------------------------------------------------------------------
  // Public collect — implements the ResearchProvider contract
  // ---------------------------------------------------------------------------

  async collect(input: ResearchProviderCollectInput): Promise<NormalizedResearchSourceInput[]> {
    const result = await this.collectWithFailover(input);
    return result.sources;
  }

  // ---------------------------------------------------------------------------
  // Failover orchestration
  // ---------------------------------------------------------------------------

  async collectWithFailover(input: ResearchProviderCollectInput): Promise<SourcingFailoverResult> {
    if (!input.config.supplementalProviders.includes(this.providerType)) {
      return {
        sources: [],
        selectedVendor: null,
        failoverReason: 'sourcing_disabled',
      };
    }

    // ── Primary: DajiSaaS ──────────────────────────────────────────────
    if (this.dajiSaas.isConfigured()) {
      logger.info(
        {
          provider: this.name,
          vendor: 'dajiSaas',
          productIdea: input.productIdea,
        },
        'Attempting DajiSaaS (primary) for 1688 sourcing',
      );

      const dajiSources = await this.collectUsable(this.dajiSaas, input);

      if (dajiSources.length > 0) {
        logger.info(
          {
            provider: this.name,
            vendor: 'dajiSaas',
            sourceCount: dajiSources.length,
            productIdea: input.productIdea,
          },
          'DajiSaaS returned usable 1688 sourcing evidence',
        );
        return {
          sources: dajiSources,
          selectedVendor: 'dajiSaas',
          failoverReason: null,
        };
      }

      logger.warn(
        {
          provider: this.name,
          vendor: 'dajiSaas',
          reason: 'no_usable_evidence',
          productIdea: input.productIdea,
        },
        'DajiSaaS returned no usable evidence — falling back to Apify',
      );
    } else {
      logger.info(
        { provider: this.name, vendor: 'dajiSaas' },
        'DajiSaaS not configured — skipping primary vendor',
      );
    }

    // ── Backup: Apify ──────────────────────────────────────────────────
    if (this.apify.isConfigured()) {
      logger.info(
        {
          provider: this.name,
          vendor: 'apify',
          productIdea: input.productIdea,
        },
        'Attempting Apify (backup) for 1688 sourcing',
      );

      const apifySources = await this.collectUsable(this.apify, input);

      if (apifySources.length > 0) {
        logger.info(
          {
            provider: this.name,
            vendor: 'apify',
            sourceCount: apifySources.length,
            productIdea: input.productIdea,
          },
          'Apify returned usable 1688 sourcing evidence',
        );
        return {
          sources: apifySources,
          selectedVendor: 'apify',
          failoverReason: 'dajiSaas_unavailable_or_no_evidence',
        };
      }

      logger.warn(
        {
          provider: this.name,
          vendor: 'apify',
          reason: 'no_usable_evidence',
          productIdea: input.productIdea,
        },
        'Apify returned no usable evidence',
      );
    } else {
      logger.info(
        { provider: this.name, vendor: 'apify' },
        'Apify not configured — skipping backup vendor',
      );
    }

    // ── Total failure — no AI fallback ─────────────────────────────────
    logger.warn(
      {
        provider: this.name,
        productIdea: input.productIdea,
        dajiSaasConfigured: this.dajiSaas.isConfigured(),
        apifyConfigured: this.apify.isConfigured(),
      },
      '1688 sourcing failed: both primary and backup vendors returned no usable evidence',
    );

    return {
      sources: [],
      selectedVendor: null,
      failoverReason: 'both_vendors_unavailable_or_no_evidence',
    };
  }

  private async collectUsable(
    adapter: SourcingProviderAdapter,
    input: ResearchProviderCollectInput,
  ): Promise<NormalizedResearchSourceInput[]> {
    try {
      const sources = await adapter.collect(input);
      return sources.filter((source) => this.isUsableSource(source));
    } catch (error) {
      logger.warn(
        { provider: this.name, vendor: adapter.vendor, error },
        '1688 vendor adapter threw during collection',
      );
      return [];
    }
  }

  private isUsableSource(source: NormalizedResearchSourceInput): boolean {
    if (!normalizedResearchSourceSchema.safeParse(source).success) {
      return false;
    }
    if (source.type !== 'SOURCING' || !source.title || !(source.externalId || source.url)) {
      return false;
    }

    const rawData = source.rawData ?? {};
    const metrics =
      rawData.metrics && typeof rawData.metrics === 'object' && !Array.isArray(rawData.metrics)
        ? (rawData.metrics as Record<string, unknown>)
        : {};
    return Boolean(
      metrics.productCost !== undefined ||
      metrics.factoryUnitCost !== undefined ||
      metrics.moq !== undefined ||
      rawData.sourcePriceCny !== undefined ||
      rawData.monthSold !== undefined ||
      rawData.tieredPrices !== undefined,
    );
  }
}
