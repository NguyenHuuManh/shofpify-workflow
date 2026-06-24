/**
 * Purpose:
 * Apify-backed marketplace candidate discovery provider.
 *
 * Responsibilities:
 * - Run configured Apify actors for product/marketplace discovery
 * - Fetch actor dataset output and normalize items into ResearchSource evidence
 * - Return empty evidence when Apify is not configured or actors fail
 *
 * Dependencies:
 * - ResearchProvider contract
 * - APIFY_CANDIDATE_DISCOVERY_* environment variables
 * - logger
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getOptionalEnvValue } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  apifyCandidateActorConfigsSchema,
  type ApifyCandidateActorConfig,
  type ApifyCandidateSourceType,
  NormalizedResearchSourceInput,
  SupplementalProviderName,
} from '@/schemas/research.schema';
import type { ResearchProvider, ResearchProviderCollectInput } from '@/types/research.types';

const APIFY_POLL_INTERVAL_MS = 3_000;
const APIFY_RUN_TIMEOUT_MS = 90_000;
const APIFY_REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_ITEMS = 10;

interface ApifyRunResponse {
  data?: {
    id?: string;
    status?: string;
  };
  id?: string;
  status?: string;
}

export class ApifyCandidateDiscoveryProvider implements ResearchProvider {
  readonly name = 'ApifyCandidateDiscoveryProvider';

  private readonly apiToken = getOptionalEnvValue('APIFY_CANDIDATE_DISCOVERY_API_TOKEN');
  private readonly endpoint =
    getOptionalEnvValue('APIFY_CANDIDATE_DISCOVERY_ENDPOINT') ?? 'https://api.apify.com/v2';
  private readonly actorConfigs = this.loadActorConfigsFromFile(
    getOptionalEnvValue('APIFY_CANDIDATE_DISCOVERY_CONFIG_PATH'),
  );
  private readonly sleepMs: number;

  constructor(sleepMs?: number) {
    this.sleepMs = sleepMs ?? APIFY_POLL_INTERVAL_MS;
  }

  async collect(input: ResearchProviderCollectInput): Promise<NormalizedResearchSourceInput[]> {
    if (!this.apiToken || this.actorConfigs.length === 0) {
      logger.warn(
        {
          provider: this.name,
          missingConfiguration:
            'APIFY_CANDIDATE_DISCOVERY_API_TOKEN/APIFY_CANDIDATE_DISCOVERY_CONFIG_PATH',
        },
        'Research provider skipped because credentials are not configured',
      );
      return [];
    }

    const sources: NormalizedResearchSourceInput[] = [];
    const queryContexts = this.discoveryQueryContexts(input);
    for (const actorConfig of this.actorConfigs) {
      if (!this.actorProviderEnabled(actorConfig, input)) {
        continue;
      }

      for (const queryContext of queryContexts) {
        const actorSources = await this.collectActorSources(actorConfig, input, queryContext);
        sources.push(...actorSources);
      }
    }

    return sources;
  }

  private actorProviderEnabled(
    actorConfig: ApifyCandidateActorConfig,
    input: ResearchProviderCollectInput,
  ): boolean {
    const providerType =
      actorConfig.providerType ?? this.providerTypeForSourceType(actorConfig.sourceType);
    if (
      input.collectionContext?.stage === 'candidate_discovery' &&
      providerType !== 'marketplace'
    ) {
      return false;
    }

    return input.config.supplementalProviders.includes(providerType);
  }

  private async collectActorSources(
    actorConfig: ApifyCandidateActorConfig,
    input: ResearchProviderCollectInput,
    queryContext: Record<string, unknown> & { query: string },
  ): Promise<NormalizedResearchSourceInput[]> {
    try {
      const runId = await this.startRun(actorConfig, input, queryContext);
      if (!runId) {
        return [];
      }

      const succeeded = await this.waitForRun(runId, actorConfig);
      if (!succeeded) {
        return [];
      }

      const datasetItems = await this.fetchDataset(runId, actorConfig);
      return datasetItems
        .slice(0, actorConfig.maxItems ?? DEFAULT_MAX_ITEMS)
        .map((item) => this.normalizeDatasetItem(item, actorConfig, queryContext))
        .filter((source): source is NormalizedResearchSourceInput => source !== undefined);
    } catch (error) {
      logger.warn(
        { provider: this.name, actorId: actorConfig.actorId, error },
        'Apify candidate discovery actor returned no evidence after error',
      );
      return [];
    }
  }

  private async startRun(
    actorConfig: ApifyCandidateActorConfig,
    input: ResearchProviderCollectInput,
    queryContext: Record<string, unknown> & { query: string },
  ): Promise<string | null> {
    const response = await this.fetchWithTimeout(
      `${this.endpoint}/acts/${encodeURIComponent(actorConfig.actorId)}/runs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify(this.buildActorInput(actorConfig, input, queryContext.query)),
      },
    );

    if (!response.ok) {
      logger.warn(
        {
          provider: this.name,
          actorId: actorConfig.actorId,
          status: response.status,
          responseBody: await this.safeErrorText(response),
        },
        'Apify candidate discovery start run request failed',
      );
      return null;
    }

    const body = (await response.json()) as ApifyRunResponse;
    const runId = body.data?.id ?? body.id;
    if (!runId) {
      logger.warn(
        { provider: this.name, actorId: actorConfig.actorId },
        'Apify candidate discovery start run response missing run ID',
      );
      return null;
    }

    logger.info(
      { provider: this.name, actorId: actorConfig.actorId, runId },
      'Apify candidate discovery run started',
    );
    return runId;
  }

  private async waitForRun(
    runId: string,
    actorConfig: ApifyCandidateActorConfig,
  ): Promise<boolean> {
    const deadline = Date.now() + APIFY_RUN_TIMEOUT_MS;

    while (Date.now() < deadline) {
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
          { provider: this.name, actorId: actorConfig.actorId, runId, status: response.status },
          'Apify candidate discovery status check failed',
        );
        return false;
      }

      const body = (await response.json()) as ApifyRunResponse;
      const status = body.data?.status ?? body.status;
      if (status === 'SUCCEEDED') {
        logger.info(
          { provider: this.name, actorId: actorConfig.actorId, runId },
          'Apify candidate discovery run succeeded',
        );
        return true;
      }

      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        logger.warn(
          { provider: this.name, actorId: actorConfig.actorId, runId, status },
          'Apify candidate discovery run finished unsuccessfully',
        );
        return false;
      }

      await this.sleep(this.sleepMs);
    }

    logger.warn(
      { provider: this.name, actorId: actorConfig.actorId, runId, timeoutMs: APIFY_RUN_TIMEOUT_MS },
      'Apify candidate discovery run timed out',
    );
    return false;
  }

  private async fetchDataset(
    runId: string,
    actorConfig: ApifyCandidateActorConfig,
  ): Promise<Record<string, unknown>[]> {
    const response = await this.fetchWithTimeout(
      `${this.endpoint}/actor-runs/${encodeURIComponent(runId)}/dataset/items?clean=true`,
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
          actorId: actorConfig.actorId,
          runId,
          status: response.status,
          responseBody: await this.safeErrorText(response),
        },
        'Apify candidate discovery dataset fetch failed',
      );
      return [];
    }

    const raw = (await response.json()) as unknown;
    if (!Array.isArray(raw)) {
      logger.warn(
        { provider: this.name, actorId: actorConfig.actorId, runId },
        'Apify candidate discovery dataset response is not an array',
      );
      return [];
    }

    return raw
      .map((item) => this.asRecord(item))
      .filter((item) => Object.keys(item).length > 0);
  }

  private normalizeDatasetItem(
    item: Record<string, unknown>,
    actorConfig: ApifyCandidateActorConfig,
    queryContext: Record<string, unknown>,
  ): NormalizedResearchSourceInput | undefined {
    const title =
      this.stringOrUndefined(item.title) ??
      this.stringOrUndefined(item.name) ??
      this.stringOrUndefined(item.productName) ??
      this.stringOrUndefined(item.product_title);
    const externalId =
      this.stringOrUndefined(item.id) ??
      this.stringOrUndefined(item.productId) ??
      this.stringOrUndefined(item.product_id) ??
      this.stringOrUndefined(item.asin) ??
      this.stringOrUndefined(item.itemId);

    if (!title && !externalId) {
      return undefined;
    }

    const url = this.validUrlOrUndefined(
      this.stringOrUndefined(item.url) ??
        this.stringOrUndefined(item.link) ??
        this.stringOrUndefined(item.productUrl) ??
        this.stringOrUndefined(item.product_url) ??
        this.stringOrUndefined(item.detailUrl),
    );
    const price = this.priceFromItem(item);
    const rating = this.numberFromFields(item, ['rating', 'stars', 'score']);
    const reviewCount = this.numberFromFields(item, [
      'reviews',
      'reviewCount',
      'review_count',
      'reviewsCount',
      'reviews_count',
      'ratingsTotal',
    ]);
    const orderCount = this.numberFromFields(item, [
      'orders',
      'orderCount',
      'sold',
      'soldCount',
      'sales',
      'salesCount',
      'trade',
    ]);
    const store = this.asRecord(item.store);
    const seller =
      this.stringOrUndefined(item.seller) ??
      this.stringOrUndefined(item.source) ??
      this.stringOrUndefined(item.merchant) ??
      this.stringOrUndefined(item.shopName) ??
      this.stringOrUndefined(item.storeName) ??
      this.stringOrUndefined(store.name);
    const providerLabel = actorConfig.label ?? `Apify ${actorConfig.actorId}`;
    const sourceType = actorConfig.sourceType ?? 'MARKETPLACE';

    return {
      type: sourceType,
      provider: providerLabel,
      url,
      externalId,
      title: this.truncate(title ?? externalId ?? 'Apify marketplace listing', 255),
      extractedSignal: this.truncate(
        [
          `${title ?? externalId} Apify ${sourceType.toLowerCase()} evidence`,
          price ? `price ${price}` : undefined,
          rating ? `rating ${rating}` : undefined,
          reviewCount ? `${reviewCount} reviews` : undefined,
          orderCount ? `${orderCount} orders/sales` : undefined,
          seller ? `seller/source ${seller}` : undefined,
        ]
          .filter(Boolean)
          .join(', '),
        2000,
      ),
      rawData: {
        ...item,
        apifyActorId: actorConfig.actorId,
        ...this.queryProvenance(queryContext),
        metrics: {
          price,
          rating,
          reviewCount,
          demandSignal:
            this.volumeToDemandScore(orderCount) ?? this.reviewCountToDemandScore(reviewCount),
        },
      },
      confidence: sourceType === 'MARKETPLACE' ? 0.74 : 0.68,
      capturedAt: new Date(),
    };
  }

  private buildActorInput(
    actorConfig: ApifyCandidateActorConfig,
    input: ResearchProviderCollectInput,
    query: string,
  ): Record<string, unknown> {
    const template: Record<string, unknown> = actorConfig.input ?? {
      query: '{{query}}',
      keyword: '{{query}}',
      maxItems: '{{maxItems}}',
      country: '{{targetMarket}}',
    };

    return this.interpolateTemplate(template, {
      query,
      queryUrlEncoded: encodeURIComponent(query),
      targetMarket: input.config.targetMarket,
      targetMarketLower: input.config.targetMarket.toLowerCase(),
      maxItems: actorConfig.maxItems ?? DEFAULT_MAX_ITEMS,
    }) as Record<string, unknown>;
  }

  private discoveryQueryContexts(
    input: ResearchProviderCollectInput,
  ): Array<Record<string, unknown> & { query: string }> {
    const selectedQueries = input.collectionContext?.selectedQueries;
    if (!selectedQueries || selectedQueries.length === 0) {
      return [
        {
          query: input.productIdea,
          queryUsed: input.productIdea,
          querySource: 'SEED_QUERY',
          queryScore: 100,
          collectionStage: input.collectionContext?.stage ?? 'candidate_discovery',
        },
      ];
    }

    return selectedQueries.map((selectedQuery) => ({
      query: selectedQuery.query,
      queryUsed: selectedQuery.query,
      querySource: selectedQuery.source,
      queryScore: selectedQuery.score,
      querySourceTypes: selectedQuery.sourceTypes,
      queryReason: selectedQuery.reason,
      collectionStage: input.collectionContext?.stage ?? 'candidate_discovery',
    }));
  }

  private queryProvenance(metadata: Record<string, unknown>): Record<string, unknown> {
    return {
      queryUsed: metadata.queryUsed,
      querySource: metadata.querySource,
      queryScore: metadata.queryScore,
      querySourceTypes: metadata.querySourceTypes,
      queryReason: metadata.queryReason,
      collectionStage: metadata.collectionStage,
    };
  }

  private interpolateTemplate(value: unknown, replacements: Record<string, string | number>): unknown {
    if (typeof value === 'string') {
      const exactMatch = value.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/u);
      if (exactMatch) {
        return replacements[exactMatch[1]!] ?? value;
      }

      return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/gu, (match, key: string) =>
        String(replacements[key] ?? match),
      );
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.interpolateTemplate(item, replacements));
    }

    const record = this.asRecord(value);
    if (Object.keys(record).length === 0) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(record).map(([key, entry]) => [key, this.interpolateTemplate(entry, replacements)]),
    );
  }

  private loadActorConfigsFromFile(configPath: string | undefined): ApifyCandidateActorConfig[] {
    if (!configPath) {
      return [];
    }

    const resolvedPath = resolve(process.cwd(), configPath);
    if (!existsSync(resolvedPath)) {
      logger.warn(
        { provider: this.name, configPath },
        'Apify candidate discovery config file was not found',
      );
      return [];
    }

    try {
      const parsed = JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown;
      return this.validateActorConfigs(parsed, configPath);
    } catch (error) {
      logger.warn(
        { provider: this.name, configPath, error },
        'Apify candidate discovery config file could not be parsed',
      );
      return [];
    }
  }

  private validateActorConfigs(
    parsed: unknown,
    source: string,
  ): ApifyCandidateActorConfig[] {
    const result = apifyCandidateActorConfigsSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn(
        {
          provider: this.name,
          source,
          validationErrors: result.error.flatten(),
        },
        'Apify candidate discovery actor config failed validation',
      );
      return [];
    }

    return result.data;
  }

  private priceFromItem(item: Record<string, unknown>): number | undefined {
    const direct = this.numberFromFields(item, ['price', 'extracted_price', 'currentPrice', 'salePrice']);
    if (direct !== undefined) {
      return direct;
    }

    const priceRecord = this.asRecord(item.price);
    return this.numberFromFields(priceRecord, ['min', 'value', 'amount', 'current', 'currentPrice']);
  }

  private numberFromFields(
    record: Record<string, unknown>,
    fields: string[],
  ): number | undefined {
    for (const field of fields) {
      const value = this.numberOrUndefined(record[field]);
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  }

  private providerTypeForSourceType(sourceType: ApifyCandidateSourceType): SupplementalProviderName {
    if (sourceType === 'SEARCH') {
      return 'search';
    }
    if (sourceType === 'TREND') {
      return 'trend';
    }
    if (sourceType === 'ADS_SIGNAL') {
      return 'adsSignal';
    }
    return 'marketplace';
  }

  private reviewCountToDemandScore(reviewCount?: number): number | undefined {
    if (reviewCount === undefined) {
      return undefined;
    }
    return Math.min(95, Math.max(20, Math.round(Math.log10(reviewCount + 1) * 24)));
  }

  private volumeToDemandScore(volume?: number): number | undefined {
    if (volume === undefined) {
      return undefined;
    }
    return Math.min(96, Math.max(25, Math.round(Math.log10(volume + 1) * 22)));
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), APIFY_REQUEST_TIMEOUT_MS);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async safeErrorText(response: Response): Promise<string | undefined> {
    try {
      const body = await response.text();
      return body ? this.truncate(body, 500) : undefined;
    } catch {
      return undefined;
    }
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private stringOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  private validUrlOrUndefined(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    try {
      return new URL(value).toString();
    } catch {
      return undefined;
    }
  }

  private numberOrUndefined(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.replace(/[$,\s]/gu, '');
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        return parsed;
      }

      const numericMatch = normalized.match(/\d+(?:\.\d+)?/u);
      if (numericMatch) {
        const fallbackParsed = Number(numericMatch[0]);
        return Number.isFinite(fallbackParsed) ? fallbackParsed : undefined;
      }
    }

    return undefined;
  }
}
