/**
 * Purpose:
 * 1688 factory sourcing research provider.
 *
 * Responsibilities:
 * - Query an approved 1688 sourcing endpoint for factory cost evidence
 * - Normalize MOQ, tiered prices, supplier metadata, and landed-cost inputs
 * - Keep 1688 and scraper API calls inside the provider layer
 *
 * Dependencies:
 * - HttpResearchProvider
 * - explicit 1688 sourcing provider environment variables
 */

import { getOptionalEnvValue } from '@/lib/env';
import type { NormalizedResearchSourceInput } from '@/schemas/research.schema';
import type { ResearchProviderCollectInput } from '@/types/research.types';
import { HttpResearchProvider, type ResearchHttpRequest } from './base-research.provider';

interface TieredPrice {
  minQuantity: number;
  unitCost: number;
}

export class Sourcing1688ResearchProvider extends HttpResearchProvider {
  readonly name = 'Sourcing1688ResearchProvider';
  readonly providerType = 'sourcing' as const;

  private readonly provider = getOptionalEnvValue('SOURCING_1688_PROVIDER') ?? 'generic';
  private readonly apiKey = getOptionalEnvValue('SOURCING_1688_API_KEY');
  private readonly endpoint = getOptionalEnvValue('SOURCING_1688_ENDPOINT');

  protected hasCredentials(): boolean {
    return Boolean(this.apiKey && this.endpoint);
  }

  protected missingConfigurationKey(): string {
    return 'SOURCING_1688_API_KEY and SOURCING_1688_ENDPOINT';
  }

  protected buildRequests(input: ResearchProviderCollectInput): ResearchHttpRequest[] {
    if (this.provider === 'apify') {
      return [
        {
          url: this.endpoint ?? 'https://example.invalid/1688-sourcing',
          init: {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              keyword: input.productIdea,
              query: input.productIdea,
              market: input.config.targetMarket,
              maxItems: 10,
            }),
          },
        },
      ];
    }

    const url = new URL(this.endpoint ?? 'https://example.invalid/1688-sourcing');
    url.searchParams.set('q', input.productIdea);
    url.searchParams.set('market', input.config.targetMarket);
    return [
      {
        url: url.toString(),
        init: {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'X-API-Key': this.apiKey ?? '',
            Accept: 'application/json',
          },
        },
      },
    ];
  }

  protected normalizeResponse(response: unknown): NormalizedResearchSourceInput[] {
    const root = this.asRecord(response);
    const results = Array.isArray(response)
      ? response
      : Array.isArray(root.results)
        ? root.results
        : Array.isArray(root.items)
          ? root.items
          : Array.isArray(root.data)
            ? root.data
            : [];

    return results.slice(0, 10).map((item): NormalizedResearchSourceInput => {
      const record = this.asRecord(item);
      const title =
        this.stringOrUndefined(record.title) ??
        this.stringOrUndefined(record.name) ??
        this.stringOrUndefined(record.subject) ??
        '1688 sourcing listing';
      const offerId =
        this.stringOrUndefined(record.offerId) ??
        this.stringOrUndefined(record.offer_id) ??
        this.stringOrUndefined(record.id);
      const url =
        this.validUrl(record.url) ??
        this.validUrl(record.productUrl) ??
        this.validUrl(record.product_url) ??
        this.validUrl(record.detailUrl) ??
        this.validUrl(record.detail_url);
      const shopName =
        this.stringOrUndefined(record.shopName) ??
        this.stringOrUndefined(record.shop_name) ??
        this.stringOrUndefined(record.supplier) ??
        this.stringOrUndefined(record.seller);
      const location =
        this.stringOrUndefined(record.location) ??
        this.stringOrUndefined(record.province) ??
        this.stringOrUndefined(record.city);
      const leadTime =
        this.stringOrUndefined(record.leadTime) ??
        this.stringOrUndefined(record.lead_time) ??
        this.stringOrUndefined(record.processingTime) ??
        this.stringOrUndefined(record.processing_time);
      const moq =
        this.numberFromUnknown(record.moq) ??
        this.numberFromUnknown(record.minOrderQuantity) ??
        this.numberFromUnknown(record.min_order_quantity);
      const tieredPrices = this.extractTieredPrices(record);
      const factoryUnitCost =
        this.numberFromUnknown(record.factoryUnitCost) ??
        this.numberFromUnknown(record.factory_unit_cost) ??
        this.numberFromUnknown(record.productCost) ??
        this.numberFromUnknown(record.cost) ??
        this.numberFromUnknown(record.price) ??
        tieredPrices[0]?.unitCost;
      const domesticShipping =
        this.numberFromUnknown(record.domesticChinaShipping) ??
        this.numberFromUnknown(record.domestic_china_shipping) ??
        this.numberFromUnknown(record.shippingCost) ??
        this.numberFromUnknown(record.shipping);
      const sourcingSignal =
        this.numberFromUnknown(record.sourcingSignal) ??
        this.numberFromUnknown(record.supplierScore) ??
        this.scoreSourcingEvidence({ moq, tieredPrices, factoryUnitCost });
      const factoryCostSignal =
        this.numberFromUnknown(record.factoryCostSignal) ??
        this.scoreFactoryCost(factoryUnitCost);
      const logisticsSignal =
        this.numberFromUnknown(record.logisticsSignal) ??
        this.scoreLogistics(domesticShipping, leadTime);

      return {
        type: 'SOURCING',
        provider: '1688',
        url,
        externalId: offerId,
        title: this.truncate(title, 255),
        extractedSignal: this.truncate(
          [
            `${title} 1688 sourcing listing`,
            shopName ? `supplier ${shopName}` : undefined,
            location ? `location ${location}` : undefined,
            moq !== undefined ? `MOQ ${moq}` : undefined,
            factoryUnitCost !== undefined ? `factory unit cost ${factoryUnitCost}` : undefined,
            domesticShipping !== undefined ? `domestic shipping ${domesticShipping}` : undefined,
            tieredPrices.length > 0 ? `${tieredPrices.length} tiered prices` : undefined,
            leadTime ? `lead time ${leadTime}` : undefined,
          ]
            .filter(Boolean)
            .join(', '),
          2000,
        ),
        rawData: {
          ...record,
          sourcePlatform: '1688',
          offerId,
          shopName,
          location,
          moq,
          tieredPrices,
          domesticChinaShipping: domesticShipping,
          leadTime,
          metrics: {
            productCost: factoryUnitCost,
            factoryUnitCost,
            shippingCost: domesticShipping,
            moq,
            sourcingSignal,
            factoryCostSignal,
            logisticsSignal,
            supplierSignal: sourcingSignal,
          },
        },
        confidence: 0.74,
        capturedAt: new Date(),
      };
    });
  }

  private extractTieredPrices(record: Record<string, unknown>): TieredPrice[] {
    const candidates = [record.tieredPrices, record.tiered_prices, record.priceRanges, record.price_ranges];
    const rawPrices = candidates.find((value) => Array.isArray(value));
    if (!Array.isArray(rawPrices)) {
      return [];
    }

    return rawPrices
      .map((value) => {
        const item = this.asRecord(value);
        const minQuantity =
          this.numberFromUnknown(item.minQuantity) ??
          this.numberFromUnknown(item.min_quantity) ??
          this.numberFromUnknown(item.startQuantity) ??
          this.numberFromUnknown(item.start_quantity) ??
          this.numberFromUnknown(item.quantity);
        const unitCost =
          this.numberFromUnknown(item.unitCost) ??
          this.numberFromUnknown(item.unit_cost) ??
          this.numberFromUnknown(item.price) ??
          this.numberFromUnknown(item.cost);

        if (minQuantity === undefined || unitCost === undefined) {
          return undefined;
        }

        return {
          minQuantity: Math.max(1, Math.round(minQuantity)),
          unitCost,
        };
      })
      .filter((value): value is TieredPrice => value !== undefined)
      .sort((a, b) => a.minQuantity - b.minQuantity);
  }

  private numberFromUnknown(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = Number.parseFloat(value.replace(/[^0-9.-]/g, ''));
      return Number.isFinite(normalized) ? normalized : undefined;
    }
    return undefined;
  }

  private validUrl(value: unknown): string | undefined {
    const raw = this.stringOrUndefined(value);
    if (!raw) {
      return undefined;
    }
    try {
      return new URL(raw).toString();
    } catch {
      return undefined;
    }
  }

  private scoreSourcingEvidence(input: {
    moq?: number;
    tieredPrices: TieredPrice[];
    factoryUnitCost?: number;
  }): number {
    let score = 55;
    if (input.factoryUnitCost !== undefined) {
      score += 10;
    }
    if (input.tieredPrices.length >= 2) {
      score += 10;
    }
    if (input.moq !== undefined && input.moq <= 500) {
      score += 10;
    }
    return Math.min(90, score);
  }

  private scoreFactoryCost(factoryUnitCost?: number): number | undefined {
    if (factoryUnitCost === undefined) {
      return undefined;
    }
    if (factoryUnitCost <= 10) {
      return 88;
    }
    if (factoryUnitCost <= 25) {
      return 78;
    }
    if (factoryUnitCost <= 50) {
      return 66;
    }
    return 55;
  }

  private scoreLogistics(domesticShipping?: number, leadTime?: string): number | undefined {
    if (domesticShipping === undefined && !leadTime) {
      return undefined;
    }
    let score = 65;
    if (domesticShipping !== undefined && domesticShipping <= 5) {
      score += 10;
    }
    if (leadTime && /\b([1-7]|[1-9]\s*-\s*[1-9])\b/.test(leadTime)) {
      score += 5;
    }
    return Math.min(85, score);
  }
}
