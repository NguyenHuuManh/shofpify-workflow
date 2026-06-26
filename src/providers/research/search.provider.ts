/**
 * Purpose:
 * Search and competitor discovery research provider.
 *
 * Responsibilities:
 * - Query DataForSEO Google Organic SERP for competitor, review, and discussion pages
 * - Normalize web result evidence into SEARCH ResearchSource payloads
 *
 * Dependencies:
 * - HttpResearchProvider
 * - DataForSEO credentials (DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD)
 */

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

  private readonly hasDataForSeo = hasDataForSeoCredentials();

  protected hasCredentials(): boolean {
    return this.hasDataForSeo;
  }

  protected missingConfigurationKey(): string {
    return 'DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD';
  }

  protected buildRequests(input: ResearchProviderCollectInput): ResearchHttpRequest[] {
    const query = `${input.productIdea} reviews competitors problems alternatives ${input.config.targetMarket}`;

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

  protected normalizeResponse(response: unknown): NormalizedResearchSourceInput[] {
    const results = extractDataForSeoItems(response);

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
        provider: 'DataForSEO Google Organic SERP',
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
