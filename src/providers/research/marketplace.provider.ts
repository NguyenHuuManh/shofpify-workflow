/**
 * Purpose:
 * Marketplace intelligence research provider.
 *
 * Responsibilities:
 * - Query marketplace/shopping data providers for listing evidence
 * - Normalize price, rating, review count, and seller signals
 *
 * Dependencies:
 * - HttpResearchProvider
 * - optional DataForSEO or SerpAPI credentials
 */

import { getOptionalEnvValue } from '@/lib/env';
import type { NormalizedResearchSourceInput } from '@/schemas/research.schema';
import type { ResearchProviderCollectInput } from '@/types/research.types';
import { HttpResearchProvider, type ResearchHttpRequest } from './base-research.provider';
import {
  buildDataForSeoRequest,
  extractDataForSeoItems,
  hasDataForSeoCredentials,
} from './dataforseo-client';

export class MarketplaceResearchProvider extends HttpResearchProvider {
  readonly name = 'MarketplaceResearchProvider';
  readonly providerType = 'marketplace' as const;

  private readonly apiKey = getOptionalEnvValue('SERPAPI_API_KEY');
  private readonly hasDataForSeo = hasDataForSeoCredentials();

  protected hasCredentials(): boolean {
    return Boolean(this.hasDataForSeo || this.apiKey);
  }

  protected missingConfigurationKey(): string {
    return 'DATAFORSEO_LOGIN/PASSWORD or SERPAPI_API_KEY';
  }

  protected buildRequests(input: ResearchProviderCollectInput): ResearchHttpRequest[] {
    const queryContexts = this.discoveryQueryContexts(input);

    if (this.hasDataForSeo) {
      return queryContexts.map((queryContext) => ({
          url: 'https://api.dataforseo.com/v3/serp/google/shopping/live/advanced',
          init: buildDataForSeoRequest(
            [
              {
                keyword: queryContext.query,
                location_name:
                  input.config.targetMarket === 'US'
                    ? 'United States'
                    : input.config.targetMarket,
                language_name: 'English',
                device: 'desktop',
                os: 'windows',
              },
            ],
          ),
          metadata: queryContext,
        }));
    }

    return queryContexts.map((queryContext) => {
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('engine', 'google_shopping');
      url.searchParams.set('q', queryContext.query);
      url.searchParams.set('api_key', this.apiKey ?? '');
      url.searchParams.set('gl', input.config.targetMarket.toLowerCase());
      return { url: url.toString(), metadata: queryContext };
    });
  }

  protected normalizeResponse(
    response: unknown,
    _input: ResearchProviderCollectInput,
    metadata?: Record<string, unknown>,
  ): NormalizedResearchSourceInput[] {
    const root = this.asRecord(response);
    const dataForSeoItems = extractDataForSeoItems(response);
    const results = dataForSeoItems.length > 0
      ? dataForSeoItems
      : Array.isArray(root.shopping_results)
        ? root.shopping_results
        : [];

    return results.slice(0, 10).map((item): NormalizedResearchSourceInput => {
      const record = this.asRecord(item);
      const title = this.stringOrUndefined(record.title) ?? 'Marketplace listing';
      const price =
        this.numberOrUndefined(record.extracted_price) ??
        this.numberOrUndefined(record.price);
      const rating = this.numberOrUndefined(record.rating);
      const reviews =
        this.numberOrUndefined(record.reviews) ??
        this.numberOrUndefined(record.reviews_count);
      const seller =
        this.stringOrUndefined(record.source) ??
        this.stringOrUndefined(record.shop_ad_aclk) ??
        this.stringOrUndefined(record.seller);
      const link =
        this.stringOrUndefined(record.url) ??
        this.stringOrUndefined(record.link) ??
        this.stringOrUndefined(record.product_link);

      return {
        type: 'MARKETPLACE',
        provider: dataForSeoItems.length > 0
          ? 'DataForSEO Google Shopping SERP'
          : 'SerpAPI Google Shopping',
        url: link,
        externalId:
          this.stringOrUndefined(record.product_id) ??
          this.stringOrUndefined(record.item_id),
        title: this.truncate(title, 255),
        extractedSignal: this.truncate(
          [
            `${title} marketplace listing`,
            price ? `price ${price}` : undefined,
            rating ? `rating ${rating}` : undefined,
            reviews ? `${reviews} reviews` : undefined,
            seller ? `seller/source ${seller}` : undefined,
          ]
            .filter(Boolean)
            .join(', '),
          2000,
        ),
        rawData: {
          ...record,
          ...this.queryProvenance(metadata),
          metrics: { price, rating, reviewCount: reviews },
        },
        confidence: 0.72,
        capturedAt: new Date(),
      };
    });
  }

  private discoveryQueryContexts(input: ResearchProviderCollectInput): Array<Record<string, unknown> & { query: string }> {
    const selectedQueries = input.collectionContext?.selectedQueries;
    if (!selectedQueries || selectedQueries.length === 0) {
      return [
        {
          query: input.productIdea,
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

  private queryProvenance(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!metadata) {
      return {};
    }

    return {
      queryUsed: typeof metadata.queryUsed === 'string'
        ? metadata.queryUsed
        : typeof metadata.query === 'string'
          ? metadata.query
          : undefined,
      querySource: metadata.querySource,
      queryScore: metadata.queryScore,
      querySourceTypes: metadata.querySourceTypes,
      queryReason: metadata.queryReason,
      collectionStage: metadata.collectionStage,
    };
  }
}
