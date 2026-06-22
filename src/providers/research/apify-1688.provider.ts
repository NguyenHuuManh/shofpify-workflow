/**
 * Purpose:
 * Apify adapter for 1688 factory sourcing intelligence.
 * Apify is the SEQUENTIAL BACKUP vendor, called ONLY when DajiSaaS fails,
 * times out, is rate-limited, fails validation, or returns no usable evidence.
 *
 * Responsibilities:
 * - Execute Apify actor runs for 1688 product discovery
 * - Poll actor run status until completion or timeout
 * - Fetch and normalize actor dataset output
 * - Normalize Apify responses into SOURCING ResearchSource records
 * - Return empty evidence on any failure (no AI fallback)
 *
 * Dependencies:
 * - SourcingProviderAdapter interface
 * - SOURCING_1688_APIFY_* environment variables
 * - logger
 */

import { getOptionalEnvValue } from '@/lib/env';
import { logger } from '@/lib/logger';
import { apify1688DatasetItemSchema } from '@/schemas/research.schema';
import type { NormalizedResearchSourceInput, ResearchRunConfig } from '@/schemas/research.schema';
import type {
  ResearchProviderCollectInput,
  SourcingProviderAdapter,
  SourcingProviderVendor,
} from '@/types/research.types';

interface TieredPrice {
  minQuantity: number;
  unitCost: number;
}

/** Milliseconds to wait between Apify status polls. */
const APIFY_POLL_INTERVAL_MS = 3_000;

/** Maximum time to wait for an Apify actor run to complete. */
const APIFY_RUN_TIMEOUT_MS = 60_000;
const APIFY_REQUEST_TIMEOUT_MS = 15_000;

interface ApifyRunResponse {
  data?: {
    id: string;
    actId?: string;
    status?: string;
  };
  id?: string;
}

interface ApifyDatasetItem {
  offerId?: string;
  offer_id?: string;
  id?: string;
  title?: string;
  name?: string;
  subject?: string;
  price?: number | string | { min?: number | string; max?: number | string; currency?: string };
  moq?: number | string;
  minOrderQuantity?: number | string;
  min_order_quantity?: number | string;
  url?: string;
  productUrl?: string;
  product_url?: string;
  detailUrl?: string;
  detail_url?: string;
  shopName?: string;
  shop_name?: string;
  supplier?: string | { companyName?: string; legalCompanyName?: string; shopUrl?: string };
  seller?: string;
  location?: string;
  province?: string;
  city?: string;
  leadTime?: string;
  lead_time?: string;
  processingTime?: string;
  processing_time?: string;
  shippingCost?: number | string;
  shipping?:
    | number
    | string
    | {
        postFee?: number | string;
        deliveryDays?: number | string;
        deliveryHours?: number | string;
        location?: string;
      };
  domesticChinaShipping?: number | string;
  domestic_china_shipping?: number | string;
  tieredPrices?: Array<{ minQuantity: number; unitCost: number }>;
  tiered_prices?: Array<{ minQuantity: number; unitCost: number }>;
  quantityPrices?: Array<{
    quantityMin?: number | string;
    quantityMax?: number | string | null;
    price?: number | string;
  }>;
}

export class Apify1688Provider implements SourcingProviderAdapter {
  readonly vendor: SourcingProviderVendor = 'apify';
  readonly name = 'Apify1688Provider';

  private readonly apiToken = getOptionalEnvValue('SOURCING_1688_APIFY_API_TOKEN');
  private readonly actorId = getOptionalEnvValue('SOURCING_1688_APIFY_ACTOR_ID');
  private readonly endpoint =
    getOptionalEnvValue('SOURCING_1688_APIFY_ENDPOINT') ?? 'https://api.apify.com/v2';
  private readonly cnyToUsdRate = this.numericValue(
    getOptionalEnvValue('SOURCING_1688_CNY_TO_USD_RATE'),
  );

  /** Injectable for tests — allows instant polling instead of real sleeps. */
  private readonly sleepMs: number;

  constructor(sleepMs?: number) {
    this.sleepMs = sleepMs ?? APIFY_POLL_INTERVAL_MS;
  }

  isConfigured(): boolean {
    return Boolean(this.apiToken && this.actorId);
  }

  async collect(input: ResearchProviderCollectInput): Promise<NormalizedResearchSourceInput[]> {
    if (!this.isConfigured()) {
      logger.warn(
        { provider: this.name },
        'Apify skipped: missing SOURCING_1688_APIFY_API_TOKEN or SOURCING_1688_APIFY_ACTOR_ID',
      );
      return [];
    }

    try {
      const runId = await this.startRun(input.productIdea);
      if (!runId) {
        logger.warn(
          { provider: this.name, productIdea: input.productIdea },
          'Apify run could not be started',
        );
        return [];
      }

      const succeeded = await this.waitForRun(runId);
      if (!succeeded) {
        logger.warn({ provider: this.name, runId }, 'Apify run did not complete successfully');
        return [];
      }

      const items = await this.fetchDataset(runId);

      if (items.length === 0) {
        logger.info(
          { provider: this.name, runId, productIdea: input.productIdea },
          'Apify run completed with empty dataset',
        );
        return [];
      }

      return items
        .slice(0, 10)
        .map((item) => this.normalizeDatasetItem(item as Record<string, unknown>, input.config));
    } catch (error) {
      logger.warn({ provider: this.name, error }, 'Apify collection threw an exception');
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Actor Run Lifecycle
  // ---------------------------------------------------------------------------

  private async startRun(keyword: string): Promise<string | null> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.endpoint}/acts/${encodeURIComponent(this.actorId ?? 'unknown')}/runs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiToken}`,
          },
          body: JSON.stringify({
            keyword,
            maxItems: 10,
            language: 'zh',
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await this.safeErrorText(response);
        logger.warn(
          {
            provider: this.name,
            status: response.status,
            responseBody: errorBody ? this.redactAuth(errorBody) : undefined,
          },
          'Apify start run request failed',
        );
        return null;
      }

      const body = (await response.json()) as ApifyRunResponse;
      const runId = body.data?.id ?? body.id;
      if (!runId) {
        logger.warn({ provider: this.name }, 'Apify start run response missing run ID');
        return null;
      }

      logger.info({ provider: this.name, runId, keyword }, 'Apify run started');
      return runId;
    } catch (error) {
      logger.warn({ provider: this.name, error }, 'Apify start run threw an exception');
      return null;
    }
  }

  private async waitForRun(runId: string): Promise<boolean> {
    const deadline = Date.now() + APIFY_RUN_TIMEOUT_MS;

    while (Date.now() < deadline) {
      try {
        const response = await this.fetchWithTimeout(
          `${this.endpoint}/actor-runs/${encodeURIComponent(runId)}`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${this.apiToken}`,
            },
          },
        );

        if (!response.ok) {
          logger.warn(
            {
              provider: this.name,
              runId,
              status: response.status,
            },
            'Apify run status check failed',
          );
          return false;
        }

        const body = (await response.json()) as ApifyRunResponse;
        const status = body.data?.status ?? (body as Record<string, unknown>).status;

        if (status === 'SUCCEEDED') {
          logger.info({ provider: this.name, runId }, 'Apify run succeeded');
          return true;
        }

        if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
          logger.warn({ provider: this.name, runId, status }, 'Apify run finished unsuccessfully');
          return false;
        }

        // Still running — wait and poll again
        await this.sleep(this.sleepMs);
      } catch (error) {
        logger.warn(
          { provider: this.name, runId, error },
          'Apify run status poll threw an exception',
        );
        return false;
      }
    }

    logger.warn(
      { provider: this.name, runId, timeoutMs: APIFY_RUN_TIMEOUT_MS },
      'Apify run timed out',
    );
    return false;
  }

  private async fetchDataset(runId: string): Promise<ApifyDatasetItem[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.endpoint}/actor-runs/${encodeURIComponent(runId)}/dataset/items`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${this.apiToken}`,
          },
        },
      );

      if (!response.ok) {
        const errorBody = await this.safeErrorText(response);
        logger.warn(
          {
            provider: this.name,
            runId,
            status: response.status,
            responseBody: errorBody ? this.redactAuth(errorBody) : undefined,
          },
          'Apify dataset fetch failed',
        );
        return [];
      }

      const raw = (await response.json()) as unknown;
      if (!Array.isArray(raw)) {
        logger.warn({ provider: this.name, runId }, 'Apify dataset response is not an array');
        return [];
      }

      const items: ApifyDatasetItem[] = [];
      for (const item of raw) {
        const parsed = apify1688DatasetItemSchema.safeParse(item);
        if (parsed.success) {
          items.push(parsed.data as ApifyDatasetItem);
        } else {
          logger.warn(
            { provider: this.name, runId, validationErrors: parsed.error.flatten() },
            'Apify dataset item failed validation',
          );
        }
      }
      return items;
    } catch (error) {
      logger.warn({ provider: this.name, runId, error }, 'Apify dataset fetch threw an exception');
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Normalization
  // ---------------------------------------------------------------------------

  private normalizeDatasetItem(
    item: Record<string, unknown>,
    _config: ResearchRunConfig,
  ): NormalizedResearchSourceInput {
    const title =
      this.stringOrUndefined(item.title) ??
      this.stringOrUndefined(item.name) ??
      this.stringOrUndefined(item.subject) ??
      '1688 Apify sourcing listing';

    const offerId =
      this.stringOrUndefined(item.offerId) ??
      this.stringOrUndefined(item.offer_id) ??
      this.stringOrUndefined(item.id);

    const url =
      this.validUrl(item.url) ??
      this.validUrl(item.productUrl) ??
      this.validUrl(item.product_url) ??
      this.validUrl(item.detailUrl) ??
      this.validUrl(item.detail_url);

    const shopName =
      this.stringOrUndefined(item.shopName) ??
      this.stringOrUndefined(item.shop_name) ??
      this.extractSupplierName(item.supplier) ??
      this.stringOrUndefined(item.seller);

    const location =
      this.stringOrUndefined(item.location) ??
      this.stringOrUndefined(item.province) ??
      this.stringOrUndefined(item.city);

    const leadTime =
      this.stringOrUndefined(item.leadTime) ??
      this.stringOrUndefined(item.lead_time) ??
      this.stringOrUndefined(item.processingTime) ??
      this.stringOrUndefined(item.processing_time) ??
      this.extractShippingLeadTime(item.shipping);

    const moq = this.numericValue(item.moq ?? item.minOrderQuantity ?? item.min_order_quantity);

    const sourceTieredPrices = this.extractTieredPrices(item);
    const tieredPrices = sourceTieredPrices
      .map((price) => ({
        minQuantity: price.minQuantity,
        unitCost: this.convertCny(price.unitCost, _config.sourcing.targetCurrency),
      }))
      .filter((price): price is TieredPrice => price.unitCost !== undefined);

    const sourcePriceCny = this.extractSourcePrice(item.price) ?? sourceTieredPrices[0]?.unitCost;
    const factoryUnitCost = this.convertCny(sourcePriceCny, _config.sourcing.targetCurrency);

    const sourceDomesticShippingCny = this.numericValue(
      item.domesticChinaShipping ??
        item.domestic_china_shipping ??
        item.shippingCost ??
        this.extractShippingPostFee(item.shipping),
    );
    const domesticShipping = this.convertCny(
      sourceDomesticShippingCny,
      _config.sourcing.targetCurrency,
    );

    const sourcingSignal = this.scoreSourcingEvidence({
      moq,
      tieredPrices,
      factoryUnitCost,
    });
    const factoryCostSignal = this.scoreFactoryCost(factoryUnitCost);
    const logisticsSignal = this.scoreLogistics(domesticShipping, leadTime);

    return {
      type: 'SOURCING',
      provider: 'apify',
      url,
      externalId: offerId,
      title: this.truncate(title, 255),
      extractedSignal: this.truncate(
        [
          `${title} 1688 Apify sourcing listing`,
          shopName ? `supplier ${shopName}` : undefined,
          location ? `location ${location}` : undefined,
          moq !== undefined ? `MOQ ${moq}` : undefined,
          sourcePriceCny !== undefined ? `factory price CNY ${sourcePriceCny}` : undefined,
          domesticShipping !== undefined ? `domestic shipping ${domesticShipping}` : undefined,
          tieredPrices.length > 0 ? `${tieredPrices.length} tiered prices` : undefined,
          leadTime ? `lead time ${leadTime}` : undefined,
        ]
          .filter(Boolean)
          .join(', '),
        2000,
      ),
      rawData: {
        sourcePlatform: '1688',
        sourceVendor: 'apify',
        sourceCurrency: 'CNY',
        targetCurrency: _config.sourcing.targetCurrency,
        conversionRate: factoryUnitCost !== undefined ? this.cnyToUsdRate : undefined,
        sourcePriceCny,
        sourceTieredPricesCny: sourceTieredPrices,
        sourceDomesticChinaShippingCny: sourceDomesticShippingCny,
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
      confidence: 0.7,
      capturedAt: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // Scoring helpers
  // ---------------------------------------------------------------------------

  private scoreSourcingEvidence(params: {
    moq?: number;
    tieredPrices: TieredPrice[];
    factoryUnitCost?: number;
  }): number {
    let score = 50;
    if (params.moq !== undefined && params.moq <= 500) score += 15;
    if (params.factoryUnitCost !== undefined && params.factoryUnitCost > 0) score += 15;
    if (params.tieredPrices.length >= 2) score += 10;
    return Math.min(100, score);
  }

  private scoreFactoryCost(cost: number | undefined): number {
    if (cost === undefined) return 50;
    if (cost <= 20) return 90;
    if (cost <= 50) return 80;
    if (cost <= 100) return 60;
    return 40;
  }

  private scoreLogistics(shipping: number | undefined, leadTime: string | undefined): number {
    let score = 50;
    if (shipping !== undefined && shipping <= 5) score += 20;
    if (leadTime && /\d/.test(leadTime)) {
      const days = Number.parseInt(leadTime.match(/(\d+)/)?.[1] ?? '0', 10);
      if (days <= 7) score += 15;
    }
    return Math.min(100, score);
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  private extractTieredPrices(record: Record<string, unknown>): TieredPrice[] {
    const prices = record.tieredPrices ?? record.tiered_prices ?? record.quantityPrices;
    if (Array.isArray(prices)) {
      return prices
        .map((p: unknown): TieredPrice | undefined => {
          if (!p || typeof p !== 'object') return undefined;
          const r = p as Record<string, unknown>;
          const minQuantity = this.numericValue(r.minQuantity ?? r.quantityMin);
          const unitCost = this.numericValue(r.unitCost ?? r.price);
          if (minQuantity === undefined || unitCost === undefined) return undefined;
          return {
            minQuantity,
            unitCost,
          };
        })
        .filter((price): price is TieredPrice => price !== undefined);
    }
    return [];
  }

  private extractSourcePrice(value: unknown): number | undefined {
    const scalar = this.numericValue(value);
    if (scalar !== undefined) return scalar;
    if (!value || typeof value !== 'object') return undefined;
    const price = value as Record<string, unknown>;
    return this.numericValue(price.min) ?? this.numericValue(price.max);
  }

  private extractSupplierName(value: unknown): string | undefined {
    const scalar = this.stringOrUndefined(value);
    if (scalar !== undefined) return scalar;
    if (!value || typeof value !== 'object') return undefined;
    const supplier = value as Record<string, unknown>;
    return (
      this.stringOrUndefined(supplier.companyName) ??
      this.stringOrUndefined(supplier.legalCompanyName)
    );
  }

  private extractShippingPostFee(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    return (value as Record<string, unknown>).postFee;
  }

  private extractShippingLeadTime(value: unknown): string | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const shipping = value as Record<string, unknown>;
    const deliveryDays = this.numericValue(shipping.deliveryDays);
    if (deliveryDays !== undefined) return `${deliveryDays} days`;
    const deliveryHours = this.numericValue(shipping.deliveryHours);
    return deliveryHours !== undefined ? `${deliveryHours} hours` : undefined;
  }

  private numericValue(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  private convertCny(value: number | undefined, targetCurrency: string): number | undefined {
    if (value === undefined) return undefined;
    if (targetCurrency.toUpperCase() === 'CNY') return value;
    if (
      targetCurrency.toUpperCase() !== 'USD' ||
      this.cnyToUsdRate === undefined ||
      this.cnyToUsdRate <= 0
    ) {
      return undefined;
    }
    return Math.round(value * this.cnyToUsdRate * 100) / 100;
  }

  private async fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), APIFY_REQUEST_TIMEOUT_MS);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private stringOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private validUrl(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.length === 0) return undefined;
    try {
      new URL(value);
      return value;
    } catch {
      return undefined;
    }
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async safeErrorText(response: Response): Promise<string | undefined> {
    try {
      const body = await response.text();
      return body ? this.truncate(this.redactAuth(body), 500) : undefined;
    } catch {
      return undefined;
    }
  }

  private redactAuth(text: string): string {
    return text.replace(
      /authorization["']?\s*[:=]\s*["']?[^"',}\s]+/gi,
      'authorization:[redacted]',
    );
  }
}
