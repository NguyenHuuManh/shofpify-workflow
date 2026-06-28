/**
 * Purpose:
 * DataForSEO Merchant Google Shopping marketplace validation provider.
 *
 * Responsibilities:
 * - Validate product-like discovery queries against Google Shopping product data
 * - Normalize Merchant product results into MARKETPLACE ResearchSource evidence
 * - Preserve query provenance for candidate aggregation auditability
 *
 * Dependencies:
 * - DataForSEO Merchant Google Products API
 * - DataForSEO shared request helpers
 * - ResearchProvider contract
 */

import { logger } from '@/lib/logger';
import type { NormalizedResearchSourceInput } from '@/schemas/research.schema';
import type { ResearchProvider, ResearchProviderCollectInput } from '@/types/research.types';
import { buildDataForSeoRequest, extractDataForSeoItems, hasDataForSeoCredentials } from './dataforseo-client';

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const DATAFORSEO_MERCHANT_PRODUCTS_ENDPOINT =
  'https://api.dataforseo.com/v3/merchant/google/products';

interface DataForSeoTaskPostResponse {
  tasks?: Array<{
    id?: string;
    status_code?: number;
    status_message?: string;
  }>;
}

export class DataForSeoMerchantProvider implements ResearchProvider {
  readonly name = 'DataForSeoMerchantProvider';
  readonly providerType = 'marketplace' as const;

  private readonly hasCredentials = hasDataForSeoCredentials();
  private readonly endpoint = DATAFORSEO_MERCHANT_PRODUCTS_ENDPOINT;

  constructor(
    private readonly pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    private readonly maxAttempts = DEFAULT_MAX_ATTEMPTS,
  ) {}

  async collect(input: ResearchProviderCollectInput): Promise<NormalizedResearchSourceInput[]> {
    if (!input.config.supplementalProviders.includes(this.providerType)) {
      return [];
    }

    if (!this.hasCredentials) {
      logger.warn(
        { provider: this.name, missingConfiguration: 'DATAFORSEO_LOGIN/PASSWORD' },
        'Research provider skipped because credentials are not configured',
      );
      return [];
    }

    const sources: NormalizedResearchSourceInput[] = [];
    for (const queryContext of this.discoveryQueryContexts(input)) {
      const querySources = await this.collectForQuery(input, queryContext);
      sources.push(...querySources);
    }
    return sources;
  }

  private async collectForQuery(
    input: ResearchProviderCollectInput,
    queryContext: Record<string, unknown> & { query: string },
  ): Promise<NormalizedResearchSourceInput[]> {
    const taskId = await this.createTask(input, queryContext.query);
    if (!taskId) {
      return [];
    }

    const response = await this.fetchTaskResult(taskId);
    if (!response) {
      return [];
    }

    return this.normalizeResponse(response, queryContext);
  }

  private async createTask(
    input: ResearchProviderCollectInput,
    query: string,
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.endpoint}/task_post`,
        buildDataForSeoRequest([
          {
            keyword: query,
            location_name:
              input.config.targetMarket === 'US'
                ? 'United States'
                : input.config.targetMarket,
            language_name: 'English',
          },
        ]),
      );

      if (!response.ok) {
        logger.warn(
          { provider: this.name, status: response.status, responseBody: await this.safeErrorText(response) },
          'DataForSEO Merchant task creation failed',
        );
        return null;
      }

      const body = (await response.json()) as DataForSeoTaskPostResponse;
      const task = Array.isArray(body.tasks) ? body.tasks[0] : undefined;
      const taskId = task?.id;
      if (!taskId) {
        logger.warn(
          { provider: this.name, statusCode: task?.status_code, statusMessage: task?.status_message },
          'DataForSEO Merchant task creation response missing task ID',
        );
        return null;
      }

      return taskId;
    } catch (error) {
      logger.warn(
        { provider: this.name, error },
        'DataForSEO Merchant task creation returned no evidence after request error',
      );
      return null;
    }
  }

  private async fetchTaskResult(taskId: string): Promise<unknown | null> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await fetch(`${this.endpoint}/task_get/advanced/${encodeURIComponent(taskId)}`, {
          ...buildDataForSeoRequest([]),
          method: 'GET',
          body: undefined,
        });

        if (!response.ok) {
          logger.warn(
            {
              provider: this.name,
              taskId,
              status: response.status,
              responseBody: await this.safeErrorText(response),
            },
            'DataForSEO Merchant task result request failed',
          );
          return null;
        }

        const body = await response.json() as unknown;
        if (extractDataForSeoItems(body).length > 0 || attempt === this.maxAttempts) {
          return body;
        }
      } catch (error) {
        logger.warn(
          { provider: this.name, taskId, error },
          'DataForSEO Merchant task result returned no evidence after request error',
        );
        return null;
      }

      await this.sleep(this.pollIntervalMs);
    }

    return null;
  }

  private normalizeResponse(
    response: unknown,
    queryContext: Record<string, unknown>,
  ): NormalizedResearchSourceInput[] {
    return this.extractMerchantItems(response)
      .map((item) => this.normalizeItem(item, queryContext))
      .filter((source): source is NormalizedResearchSourceInput => source !== undefined)
      .slice(0, 10);
  }

  private extractMerchantItems(response: unknown): Record<string, unknown>[] {
    return extractDataForSeoItems(response).flatMap((item) => {
      const nestedItems = item.items;
      if (Array.isArray(nestedItems) && nestedItems.length > 0) {
        const itemType = this.stringOrUndefined(item.type);
        logger.debug(
          {
            provider: this.name,
            containerType: itemType,
            containerTitle: this.stringOrUndefined(item.title),
            nestedCount: nestedItems.length,
          },
          'Flattening nested Merchant items into individual product sources',
        );
        return nestedItems.map((nestedItem) => this.asRecord(nestedItem));
      }

      return [item];
    });
  }

  private normalizeItem(
    item: Record<string, unknown>,
    queryContext: Record<string, unknown>,
  ): NormalizedResearchSourceInput | undefined {
    const title =
      this.stringOrUndefined(item.title) ??
      this.stringOrUndefined(item.product_title) ??
      this.stringOrUndefined(item.productTitle) ??
      this.stringOrUndefined(item.name);
    const externalId =
      this.stringOrUndefined(item.product_id) ??
      this.stringOrUndefined(item.productId) ??
      this.stringOrUndefined(item.gid) ??
      this.stringOrUndefined(item.item_id) ??
      this.stringOrUndefined(item.id);

    if (!title && !externalId) {
      return undefined;
    }

    const priceRecord = this.asRecord(item.price);
    const price =
      this.numberOrUndefined(item.price) ??
      this.numberOrUndefined(item.extracted_price) ??
      this.numberOrUndefined(item.current_price) ??
      this.numberOrUndefined(priceRecord.current) ??
      this.numberOrUndefined(priceRecord.value);
    const currency =
      this.stringOrUndefined(item.currency) ??
      this.stringOrUndefined(priceRecord.currency);
    const rating = this.numberFromFields(item, ['rating', 'product_rating', 'shop_rating']);
    const reviewCount = this.numberFromFields(item, [
      'reviews_count',
      'review_count',
      'reviews',
      'votes',
      'rating_count',
      'ratingCount',
    ]);
    const seller =
      this.stringOrUndefined(item.seller) ??
      this.stringOrUndefined(item.source) ??
      this.stringOrUndefined(item.shop_name) ??
      this.stringOrUndefined(item.merchant) ??
      this.stringOrUndefined(item.domain);
    const url = this.validUrlOrUndefined(
      this.stringOrUndefined(item.url) ??
        this.stringOrUndefined(item.shopping_url) ??
        this.stringOrUndefined(item.shoppingUrl) ??
        this.stringOrUndefined(item.product_url) ??
        this.stringOrUndefined(item.productUrl) ??
        this.stringOrUndefined(item.product_link) ??
        this.stringOrUndefined(item.productLink) ??
        this.stringOrUndefined(item.seller_url) ??
        this.stringOrUndefined(item.sellerUrl) ??
        this.stringOrUndefined(item.link) ??
        this.stringOrUndefined(item.url_redirect),
    );
    const imageUrls = this.extractImageUrls(item);
    const imageUrl = imageUrls[0];

    // Defensive guard: carousel container items must be flattened by extractMerchantItems.
    // If a carousel-level item reaches normalizeItem, it means nested extraction failed.
    const itemType = this.stringOrUndefined(item.type);
    const hasNestedItems = Array.isArray(item.items) && item.items.length > 0;
    if (itemType === 'google_shopping_carousel' && hasNestedItems) {
      logger.warn(
        {
          provider: this.name,
          containerTitle: this.stringOrUndefined(item.title),
          nestedCount: (item.items as unknown[]).length,
        },
        'Carousel container item reached normalizeItem — nested extraction may have failed. Skipping.',
      );
      return undefined;
    }

    if (!this.isProductLikeItem({ url, externalId, price, rating, reviewCount, seller, imageUrls })) {
      return undefined;
    }

    return {
      type: 'MARKETPLACE',
      provider: 'DataForSEO Merchant Google Products',
      url,
      externalId,
      title: this.truncate(title ?? externalId ?? 'DataForSEO Merchant product', 255),
      extractedSignal: this.truncate(
        [
          `${title ?? externalId} marketplace listing`,
          price !== undefined ? `price ${price}${currency ? ` ${currency}` : ''}` : undefined,
          rating !== undefined ? `rating ${rating}` : undefined,
          reviewCount !== undefined ? `${reviewCount} reviews/votes` : undefined,
          seller ? `seller/source ${seller}` : undefined,
        ].filter(Boolean).join(', '),
        2000,
      ),
      rawData: {
        ...item,
        ...(imageUrl ? { imageUrl } : {}),
        ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
        dataForSeoEndpoint: 'merchant/google/products',
        ...this.queryProvenance(queryContext),
        metrics: {
          price,
          currency,
          rating,
          reviewCount,
          seller,
          ...(imageUrl ? { imageUrl } : {}),
          demandSignal: this.reviewCountToDemandScore(reviewCount),
        },
      },
      confidence: price !== undefined ? 0.78 : 0.68,
      capturedAt: new Date(),
    };
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

  private reviewCountToDemandScore(reviewCount: number | undefined): number | undefined {
    if (reviewCount === undefined) {
      return undefined;
    }
    return Math.min(95, Math.max(35, Math.round(Math.log10(reviewCount + 1) * 24)));
  }

  private numberFromFields(record: Record<string, unknown>, fields: string[]): number | undefined {
    for (const field of fields) {
      const value = this.numberOrUndefined(record[field]);
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private stringOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  private isProductLikeItem(input: {
    url?: string;
    externalId?: string;
    price?: number;
    rating?: number;
    reviewCount?: number;
    seller?: string;
    imageUrls: string[];
  }): boolean {
    return Boolean(
      input.url ||
        input.externalId ||
        input.price !== undefined ||
        input.rating !== undefined ||
        input.reviewCount !== undefined ||
        input.seller ||
        input.imageUrls.length > 0,
    );
  }

  private extractImageUrls(item: Record<string, unknown>): string[] {
    const urls = new Set<string>();
    const add = (value: unknown): void => {
      const url = this.validUrlOrUndefined(this.stringOrUndefined(value));
      if (url) {
        urls.add(url);
      }
    };

    for (const key of [
      'image',
      'image_url',
      'imageUrl',
      'thumbnail',
      'thumbnail_url',
      'thumbnailUrl',
      'product_image',
      'productImage',
      'image_link',
      'imageLink',
    ]) {
      add(item[key]);
    }

    for (const key of ['images', 'product_images', 'productImages', 'thumbnails']) {
      const value = item[key];
      if (Array.isArray(value)) {
        value.forEach((image) => {
          if (typeof image === 'string') {
            add(image);
            return;
          }

          if (image && typeof image === 'object' && !Array.isArray(image)) {
            const record = image as Record<string, unknown>;
            add(record.url ?? record.link ?? record.image ?? record.imageUrl);
          }
        });
      }
    }

    const productPhotos = item.product_photos ?? item.productPhotos;
    if (Array.isArray(productPhotos)) {
      for (const photo of productPhotos) {
        if (typeof photo === 'string') {
          add(photo);
          continue;
        }
        if (photo && typeof photo === 'object' && !Array.isArray(photo)) {
          const record = photo as Record<string, unknown>;
          add(record.url ?? record.link ?? record.image ?? record.imageUrl);
        }
      }
    }

    return Array.from(urls);
  }

  private numberOrUndefined(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
  }

  private async safeErrorText(response: Response): Promise<string | undefined> {
    try {
      const body = await response.text();
      return body ? this.truncate(body, 500) : undefined;
    } catch {
      return undefined;
    }
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
