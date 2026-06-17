/**
 * Purpose:
 * Search and competitor discovery research provider.
 *
 * Responsibilities:
 * - Query approved search APIs for competitor, review, and discussion pages
 * - Normalize web result evidence into SEARCH ResearchSource payloads
 *
 * Dependencies:
 * - HttpResearchProvider
 * - optional DataForSEO, Brave Search, or SerpAPI credentials
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

export class SearchResearchProvider extends HttpResearchProvider {
  readonly name = 'SearchResearchProvider';
  readonly providerType = 'search' as const;

  private readonly braveApiKey = getOptionalEnvValue('BRAVE_SEARCH_API_KEY');
  private readonly serpApiKey = getOptionalEnvValue('SERPAPI_API_KEY');
  private readonly hasDataForSeo = hasDataForSeoCredentials();

  protected hasCredentials(): boolean {
    return Boolean(this.hasDataForSeo || this.braveApiKey || this.serpApiKey);
  }

  protected missingConfigurationKey(): string {
    return 'DATAFORSEO_LOGIN/PASSWORD, BRAVE_SEARCH_API_KEY, or SERPAPI_API_KEY';
  }

  protected buildRequests(input: ResearchProviderCollectInput): ResearchHttpRequest[] {
    const query = `${input.productIdea} reviews competitors problems alternatives ${input.config.targetMarket}`;

    if (this.hasDataForSeo) {
      return [
        {
          url: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
          init: buildDataForSeoRequest(
            [
              {
                keyword: query,
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
        },
      ];
    }

    if (this.braveApiKey) {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', '10');
      return [
        {
          url: url.toString(),
          init: {
            headers: {
              Accept: 'application/json',
              'X-Subscription-Token': this.braveApiKey,
            },
          },
        },
      ];
    }

    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', query);
    url.searchParams.set('api_key', this.serpApiKey ?? '');
    return [{ url: url.toString() }];
  }

  protected normalizeResponse(response: unknown): NormalizedResearchSourceInput[] {
    const root = this.asRecord(response);
    const dataForSeoItems = extractDataForSeoItems(response);
    const braveResults = this.asRecord(root.web).results;
    const serpResults = root.organic_results;
    const results = dataForSeoItems.length > 0
      ? dataForSeoItems
      : Array.isArray(braveResults)
      ? braveResults
      : Array.isArray(serpResults)
        ? serpResults
        : [];

    return results.slice(0, 10).map((item): NormalizedResearchSourceInput => {
      const record = this.asRecord(item);
      const title = this.stringOrUndefined(record.title) ?? 'Search result';
      const url =
        this.stringOrUndefined(record.url) ??
        this.stringOrUndefined(record.link);
      const description =
        this.stringOrUndefined(record.description) ??
        this.stringOrUndefined(record.snippet) ??
        this.stringOrUndefined(record.breadcrumb) ??
        'Search result matched the research query.';

      return {
        type: 'SEARCH',
        provider: dataForSeoItems.length > 0
          ? 'DataForSEO Google Organic SERP'
          : this.braveApiKey
            ? 'Brave Search'
            : 'SerpAPI Google Search',
        url,
        title: this.truncate(title, 255),
        extractedSignal: this.truncate(description, 2000),
        rawData: record,
        confidence: 0.68,
        capturedAt: new Date(),
      };
    });
  }
}
