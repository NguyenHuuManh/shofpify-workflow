/**
 * Purpose:
 * Trend intelligence research provider.
 *
 * Responsibilities:
 * - Query approved trends APIs for demand direction and seasonality evidence
 * - Normalize trend data into TREND ResearchSource payloads
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
  extractDataForSeoResults,
  hasDataForSeoCredentials,
} from './dataforseo-client';

export class TrendResearchProvider extends HttpResearchProvider {
  readonly name = 'TrendResearchProvider';
  readonly providerType = 'trend' as const;

  private readonly apiKey = getOptionalEnvValue('SERPAPI_API_KEY');
  private readonly hasDataForSeo = hasDataForSeoCredentials();

  protected hasCredentials(): boolean {
    return Boolean(this.hasDataForSeo || this.apiKey);
  }

  protected missingConfigurationKey(): string {
    return 'DATAFORSEO_LOGIN/PASSWORD or SERPAPI_API_KEY';
  }

  protected buildRequests(input: ResearchProviderCollectInput): ResearchHttpRequest[] {
    if (this.hasDataForSeo) {
      return [
        {
          url: 'https://api.dataforseo.com/v3/keywords_data/google_trends/explore/live',
          init: buildDataForSeoRequest(
            [
              {
                keywords: [input.productIdea],
                location_name:
                  input.config.targetMarket === 'US'
                    ? 'United States'
                    : input.config.targetMarket,
                language_name: 'English',
                type: 'web',
              },
            ],
          ),
        },
      ];
    }

    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google_trends');
    url.searchParams.set('q', input.productIdea);
    url.searchParams.set('api_key', this.apiKey ?? '');
    const relatedUrl = new URL('https://serpapi.com/search.json');
    relatedUrl.searchParams.set('engine', 'google_trends');
    relatedUrl.searchParams.set('q', input.productIdea);
    relatedUrl.searchParams.set('data_type', 'RELATED_QUERIES');
    relatedUrl.searchParams.set('api_key', this.apiKey ?? '');
    return [{ url: url.toString() }, { url: relatedUrl.toString() }];
  }

  protected normalizeResponse(response: unknown, input: ResearchProviderCollectInput): NormalizedResearchSourceInput[] {
    const root = this.asRecord(response);
    const dataForSeoAverage = this.extractDataForSeoAverage(response);
    const timeline = this.asRecord(root.interest_over_time).timeline_data;
    const points = Array.isArray(timeline) ? timeline : [];
    const recentValues = points
      .slice(-8)
      .map((point) => {
        const record = this.asRecord(point);
        const values = Array.isArray(record.values) ? record.values : [];
        const firstValue = this.asRecord(values[0]);
        return this.numberOrUndefined(firstValue.extracted_value);
      })
      .filter((value): value is number => value !== undefined);

    const average =
      dataForSeoAverage ??
      (recentValues.length > 0
        ? Math.round(recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length)
        : undefined);

    return [
      {
        type: 'TREND',
        provider: dataForSeoAverage === undefined
          ? 'SerpAPI Google Trends'
          : 'DataForSEO Google Trends',
        title: `${input.productIdea} trend signal`,
        extractedSignal: average
          ? `Recent trend interest average is ${average} for "${input.productIdea}".`
          : `Trend response captured for "${input.productIdea}".`,
        rawData: {
          query: input.productIdea,
          recentInterestAverage: average,
          response: root,
        },
        confidence: average === undefined ? 0.5 : 0.7,
        capturedAt: new Date(),
      },
    ];
  }

  private extractDataForSeoAverage(response: unknown): number | undefined {
    const results = extractDataForSeoResults(response);
    const values = results.flatMap((result) => this.extractTrendValues(result));
    if (values.length === 0) {
      return undefined;
    }
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private extractTrendValues(value: unknown): number[] {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return [value];
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => this.extractTrendValues(item));
    }

    const record = this.asRecord(value);
    const direct =
      this.numberOrUndefined(record.value) ??
      this.numberOrUndefined(record.extracted_value);
    const nested = Object.entries(record)
      .filter(([key]) => ['items', 'data', 'values'].includes(key))
      .flatMap(([, nestedValue]) => this.extractTrendValues(nestedValue));

    return direct === undefined ? nested : [direct, ...nested];
  }
}
