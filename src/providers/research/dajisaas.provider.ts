/**
 * Purpose:
 * DajiSaaS adapter for 1688 factory sourcing intelligence.
 *
 * Responsibilities:
 * - Sign DajiSaaS GET requests using its documented MD5 parameter signature
 * - Collect keyword-search results and enrich them with product details
 * - Preserve source CNY values and convert costs only when a configured rate exists
 * - Return empty evidence on vendor, timeout, or validation failures
 *
 * Dependencies:
 * - DajiSaaS response schemas
 * - explicit DajiSaaS environment variables
 * - logger
 */

import { createHash } from 'node:crypto';
import { getOptionalEnvValue } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  dajiSaasProductDetailSchema,
  dajiSaasSearchResponseSchema,
} from '@/schemas/research.schema';
import type {
  DajiSaasProductDetail,
  DajiSaasSearchItem,
  NormalizedResearchSourceInput,
} from '@/schemas/research.schema';
import type {
  ResearchProviderCollectInput,
  SourcingProviderAdapter,
  SourcingProviderVendor,
} from '@/types/research.types';

interface TieredPrice {
  minQuantity: number;
  unitCost: number;
}

const REQUEST_TIMEOUT_MS = 15_000;
const SEARCH_LIMIT = 10;

export class DajiSaasProvider implements SourcingProviderAdapter {
  readonly vendor: SourcingProviderVendor = 'dajiSaas';
  readonly name = 'DajiSaasProvider';

  private readonly appKey = getOptionalEnvValue('SOURCING_1688_DAJISAAS_API_KEY');
  private readonly appSecret = getOptionalEnvValue('SOURCING_1688_DAJISAAS_API_SECRET');
  private readonly endpoint =
    getOptionalEnvValue('SOURCING_1688_DAJISAAS_ENDPOINT') ?? 'https://openapi.dajisaas.com';
  private readonly country = getOptionalEnvValue('SOURCING_1688_DAJISAAS_COUNTRY') ?? 'en';
  private readonly cnyToUsdRate = this.positiveNumber(
    getOptionalEnvValue('SOURCING_1688_CNY_TO_USD_RATE'),
  );

  isConfigured(): boolean {
    return Boolean(this.appKey && this.appSecret && this.endpoint);
  }

  async collect(input: ResearchProviderCollectInput): Promise<NormalizedResearchSourceInput[]> {
    if (!this.isConfigured()) {
      logger.warn(
        { provider: this.name },
        'DajiSaaS skipped because credentials are not configured',
      );
      return [];
    }

    const searchItems = await this.keywordSearch(input.productIdea);
    if (searchItems.length === 0) {
      return [];
    }

    const sources = searchItems.map((item) => this.normalizeSearchItem(item, input));
    const details = await Promise.all(
      sources.map((source) =>
        source.externalId ? this.productDetail(source.externalId) : Promise.resolve(null),
      ),
    );

    return sources.map((source, index) =>
      details[index] ? this.mergeDetailIntoSource(source, details[index]!, input) : source,
    );
  }

  private async keywordSearch(query: string): Promise<DajiSaasSearchItem[]> {
    if (!/[\u3400-\u9fff]/u.test(query)) {
      logger.warn(
        { provider: this.name },
        'DajiSaaS documents keyword search as requiring a Chinese keyword',
      );
    }

    const raw = await this.getJson('/alibaba/product/keywordQuery', {
      keyword: query,
      beginPage: 1,
      pageSize: SEARCH_LIMIT,
      country: this.country,
    });
    if (!raw) {
      return [];
    }

    const parsed = dajiSaasSearchResponseSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(
        { provider: this.name, validationErrors: parsed.error.flatten() },
        'DajiSaaS keyword response failed validation',
      );
      return [];
    }
    if (parsed.data.code !== 200) {
      logger.warn(
        { provider: this.name, code: parsed.data.code, message: parsed.data.message },
        'DajiSaaS keyword search returned a business error',
      );
      return [];
    }

    return parsed.data.data.data.slice(0, SEARCH_LIMIT);
  }

  private async productDetail(offerId: string): Promise<DajiSaasProductDetail['data'] | null> {
    const raw = await this.getJson('/alibaba/product/queryProductDetail', {
      offerId,
      country: this.country,
    });
    if (!raw) {
      return null;
    }

    const parsed = dajiSaasProductDetailSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(
        { provider: this.name, offerId, validationErrors: parsed.error.flatten() },
        'DajiSaaS product-detail response failed validation',
      );
      return null;
    }
    if (parsed.data.code !== 200) {
      logger.warn(
        { provider: this.name, offerId, code: parsed.data.code, message: parsed.data.message },
        'DajiSaaS product detail returned a business error',
      );
      return null;
    }

    return parsed.data.data;
  }

  private async getJson(
    path: string,
    requestParameters: Record<string, string | number>,
  ): Promise<unknown | null> {
    const parameters: Record<string, string | number> = {
      appKey: this.appKey!,
      ...requestParameters,
    };
    const sign = this.signParameters(parameters);
    const url = new URL(path, this.endpoint);
    for (const [key, value] of Object.entries({ ...parameters, sign })) {
      url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        logger.warn(
          { provider: this.name, path, status: response.status },
          'DajiSaaS HTTP request failed',
        );
        return null;
      }
      return (await response.json()) as unknown;
    } catch (error) {
      logger.warn({ provider: this.name, path, error }, 'DajiSaaS request failed or timed out');
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private signParameters(parameters: Record<string, string | number>): string {
    const signingString = Object.keys(parameters)
      .filter((key) => key !== 'sign' && parameters[key] !== undefined)
      .sort()
      .map((key) => `${key}=${parameters[key]}`)
      .join('&');
    return createHash('md5')
      .update(`${signingString}&secret=${this.appSecret!}`, 'utf8')
      .digest('hex')
      .toUpperCase();
  }

  private normalizeSearchItem(
    item: DajiSaasSearchItem,
    input: ResearchProviderCollectInput,
  ): NormalizedResearchSourceInput {
    const offerId = String(item.offerId);
    const title = item.subjectTrans || item.subject;
    const sourcePriceCny = this.positiveNumber(item.priceInfo.price);
    const factoryUnitCost = this.convertCny(sourcePriceCny, input.config.sourcing.targetCurrency);
    const demandSignal = this.demandSignal(item.monthSold);

    return {
      type: 'SOURCING',
      provider: 'dajiSaas',
      url: `https://detail.1688.com/offer/${offerId}.html`,
      externalId: offerId,
      title: this.truncate(title, 255),
      extractedSignal: this.truncate(
        [
          `${title} 1688 offer`,
          sourcePriceCny !== undefined ? `factory price CNY ${sourcePriceCny}` : undefined,
          item.monthSold !== undefined ? `30-day sales ${item.monthSold}` : undefined,
          item.repurchaseRate ? `repurchase rate ${item.repurchaseRate}` : undefined,
        ]
          .filter(Boolean)
          .join(', '),
        2000,
      ),
      rawData: {
        sourcePlatform: '1688',
        sourceVendor: 'dajiSaas',
        sourceCurrency: 'CNY',
        targetCurrency: input.config.sourcing.targetCurrency,
        conversionRate: factoryUnitCost !== undefined ? this.cnyToUsdRate : undefined,
        sourcePriceCny,
        imageUrl: item.imageUrl,
        subject: item.subject,
        subjectTrans: item.subjectTrans,
        monthSold: item.monthSold,
        repurchaseRate: item.repurchaseRate,
        sellerIdentities: item.sellerIdentities,
        isOnePsale: item.isOnePsale,
        priceInfo: item.priceInfo,
        metrics: {
          demandSignal,
          productCost: factoryUnitCost,
          factoryUnitCost,
          sourcingSignal: sourcePriceCny !== undefined ? 65 : 50,
          factoryCostSignal:
            factoryUnitCost !== undefined ? this.scoreFactoryCost(factoryUnitCost) : undefined,
        },
      },
      confidence: 0.72,
      capturedAt: new Date(),
    };
  }

  private mergeDetailIntoSource(
    source: NormalizedResearchSourceInput,
    detail: DajiSaasProductDetail['data'],
    input: ResearchProviderCollectInput,
  ): NormalizedResearchSourceInput {
    const sourceTieredPrices = (detail.productSaleInfo?.priceRangeList ?? [])
      .map((range) => ({
        minQuantity: Math.max(1, Math.round(this.positiveNumber(range.startQuantity) ?? 1)),
        unitCost: this.positiveNumber(range.price),
      }))
      .filter((range): range is TieredPrice => range.unitCost !== undefined)
      .sort((a, b) => a.minQuantity - b.minQuantity);
    const tieredPrices = sourceTieredPrices
      .map((range) => ({
        minQuantity: range.minQuantity,
        unitCost: this.convertCny(range.unitCost, input.config.sourcing.targetCurrency),
      }))
      .filter((range): range is TieredPrice => range.unitCost !== undefined);
    const moq = this.positiveNumber(detail.minOrderQuantity) ?? sourceTieredPrices[0]?.minQuantity;
    const sourcePriceCny = sourceTieredPrices[0]?.unitCost;
    const factoryUnitCost = this.convertCny(sourcePriceCny, input.config.sourcing.targetCurrency);
    const location = detail.productShippingInfo?.sendGoodsAddressText;
    const existingRaw = (source.rawData ?? {}) as Record<string, unknown>;
    const existingMetrics = this.record(existingRaw.metrics);

    return {
      ...source,
      confidence: 0.8,
      extractedSignal: this.truncate(
        [
          source.title,
          moq !== undefined ? `MOQ ${moq}` : undefined,
          sourcePriceCny !== undefined ? `factory price CNY ${sourcePriceCny}` : undefined,
          location ? `ships from ${location}` : undefined,
          sourceTieredPrices.length > 0 ? `${sourceTieredPrices.length} price tiers` : undefined,
        ]
          .filter(Boolean)
          .join(', '),
        2000,
      ),
      rawData: {
        ...existingRaw,
        offerId: String(detail.offerId),
        sourcePriceCny: sourcePriceCny ?? existingRaw.sourcePriceCny,
        sourceTieredPricesCny: sourceTieredPrices,
        tieredPrices,
        moq,
        location,
        images: detail.productImage?.images,
        productAttributes: detail.productAttribute,
        productSkuInfos: detail.productSkuInfos,
        shippingInfo: detail.productShippingInfo,
        sellerOpenId: detail.sellerOpenId,
        sellerDataInfo: detail.sellerDataInfo,
        soldOut: detail.soldOut,
        metrics: {
          ...existingMetrics,
          productCost: factoryUnitCost ?? existingMetrics.productCost,
          factoryUnitCost: factoryUnitCost ?? existingMetrics.factoryUnitCost,
          moq,
          sourcingSignal: moq !== undefined && sourceTieredPrices.length > 0 ? 80 : 65,
          factoryCostSignal:
            factoryUnitCost !== undefined
              ? this.scoreFactoryCost(factoryUnitCost)
              : existingMetrics.factoryCostSignal,
          logisticsSignal: location ? 65 : undefined,
        },
      },
    };
  }

  private convertCny(value: number | undefined, targetCurrency: string): number | undefined {
    if (value === undefined) return undefined;
    if (targetCurrency.toUpperCase() === 'CNY') return value;
    if (targetCurrency.toUpperCase() !== 'USD' || this.cnyToUsdRate === undefined) {
      return undefined;
    }
    return Math.round(value * this.cnyToUsdRate * 100) / 100;
  }

  private demandSignal(monthSold: number | undefined): number | undefined {
    if (monthSold === undefined) return undefined;
    if (monthSold >= 5000) return 90;
    if (monthSold >= 1000) return 80;
    if (monthSold >= 200) return 70;
    if (monthSold >= 50) return 60;
    return 45;
  }

  private scoreFactoryCost(cost: number): number {
    if (cost <= 10) return 88;
    if (cost <= 25) return 78;
    if (cost <= 50) return 66;
    return 55;
  }

  private positiveNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ''));
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
    }
    return undefined;
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
  }
}
