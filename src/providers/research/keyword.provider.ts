/**
 * Purpose:
 * Keyword intelligence research provider.
 *
 * Responsibilities:
 * - Query approved SEO APIs for search volume, CPC, and competition evidence
 * - Normalize keyword metrics into KEYWORD ResearchSource payloads
 *
 * Dependencies:
 * - HttpResearchProvider
 * - DataForSEO (primary) or SerpAPI Google Ads (fallback)
 */

import { getOptionalEnvValue } from '@/lib/env';
import type { NormalizedResearchSourceInput } from '@/schemas/research.schema';
import type { ResearchProviderCollectInput } from '@/types/research.types';
import { HttpResearchProvider, type ResearchHttpRequest } from './base-research.provider';
import { buildDataForSeoRequest } from './dataforseo-client';

export class KeywordResearchProvider extends HttpResearchProvider {
  readonly name = 'KeywordResearchProvider';
  readonly providerType = 'keyword' as const;

  private readonly login = getOptionalEnvValue('DATAFORSEO_LOGIN');
  private readonly password = getOptionalEnvValue('DATAFORSEO_PASSWORD');
  private readonly serpApiKey = getOptionalEnvValue('SERPAPI_API_KEY');

  protected hasCredentials(): boolean {
    return Boolean((this.login && this.password) || this.serpApiKey);
  }

  protected missingConfigurationKey(): string {
    return 'DATAFORSEO_LOGIN/PASSWORD or SERPAPI_API_KEY';
  }

  protected buildRequests(input: ResearchProviderCollectInput): ResearchHttpRequest[] {
    // Primary: DataForSEO
    if (this.login && this.password) {
      return [
        {
          url: 'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
          init: buildDataForSeoRequest([
            {
              keywords: [input.productIdea],
              location_name: input.config.targetMarket === 'US' ? 'United States' : input.config.targetMarket,
              language_name: 'English',
            },
          ]),
        },
      ];
    }

    // Fallback: SerpAPI Google Ads
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google_ads');
    url.searchParams.set('q', input.productIdea);
    url.searchParams.set('gl', input.config.targetMarket.toLowerCase());
    url.searchParams.set('hl', 'en');
    url.searchParams.set('location', input.config.targetMarket === 'US' ? 'United States' : input.config.targetMarket);
    url.searchParams.set('api_key', this.serpApiKey ?? '');
    return [{ url: url.toString() }];
  }

  protected normalizeResponse(response: unknown, input: ResearchProviderCollectInput): NormalizedResearchSourceInput[] {
    const root = this.asRecord(response);

    // DataForSEO response format
    const tasks = Array.isArray(root.tasks) ? root.tasks : [];
    const firstTask = this.asRecord(tasks[0]);
    const dfResult = Array.isArray(firstTask.result) ? firstTask.result : [];

    if (dfResult.length > 0) {
      return dfResult.slice(0, 10).map((item) => this.normalizeDataForSeoItem(item, input));
    }

    // SerpAPI Google Ads response — key is 'keyword_ideas'
    const keywordIdeas = Array.isArray(root.keyword_ideas) ? root.keyword_ideas : [];
    const keywords = Array.isArray(root.keywords) ? root.keywords : [];

    if (keywordIdeas.length > 0) {
      return keywordIdeas.slice(0, 10).map((item) => this.normalizeSerpApiItem(item, input));
    }

    // SerpAPI related keywords
    return keywords.slice(0, 10).map((item) => this.normalizeSerpApiKeywordItem(item, input));
  }

  private normalizeDataForSeoItem(item: unknown, input: ResearchProviderCollectInput): NormalizedResearchSourceInput {
    const record = this.asRecord(item);
    const keyword = this.stringOrUndefined(record.keyword) ?? input.productIdea;
    const volume = this.numberOrUndefined(record.search_volume);
    const cpc = this.numberOrUndefined(record.cpc);
    const competition = this.numberOrUndefined(record.competition_index);

    return this.buildKeywordSource(keyword, volume, cpc, competition, 'DataForSEO Google Ads', record);
  }

  private normalizeSerpApiItem(item: unknown, input: ResearchProviderCollectInput): NormalizedResearchSourceInput {
    const record = this.asRecord(item);
    const keyword = this.stringOrUndefined(record.keyword) ?? input.productIdea;
    const volume = this.numberOrUndefined(record.search_volume);
    const cpc = this.numberOrUndefined(record.cpc);
    const competition = this.numberOrUndefined(record.competition);

    return this.buildKeywordSource(keyword, volume, cpc, competition, 'SerpAPI Google Ads', record);
  }

  private normalizeSerpApiKeywordItem(item: unknown, input: ResearchProviderCollectInput): NormalizedResearchSourceInput {
    const record = this.asRecord(item);
    const keyword = this.stringOrUndefined(record.keyword) ?? input.productIdea;
    const volume = this.numberOrUndefined(record.search_volume);
    const cpc = this.numberOrUndefined(record.cpc);
    const competition = this.numberOrUndefined(record.competition);

    return this.buildKeywordSource(keyword, volume, cpc, competition, 'SerpAPI Google Ads', record);
  }

  private buildKeywordSource(
    keyword: string,
    volume: number | undefined,
    cpc: number | undefined,
    competition: number | undefined,
    provider: string,
    rawData: Record<string, unknown>,
  ): NormalizedResearchSourceInput {
    return {
      type: 'KEYWORD',
      provider,
      externalId: keyword,
      title: `${keyword} keyword signal`,
      extractedSignal: this.truncate(
        [
          `${keyword} keyword evidence`,
          volume !== undefined ? `search volume ${volume}` : undefined,
          cpc !== undefined ? `CPC ${cpc}` : undefined,
          competition !== undefined ? `competition ${competition}` : undefined,
        ].filter(Boolean).join(', '),
        2000,
      ),
      rawData: {
        ...rawData,
        keyword,
        metrics: { searchVolume: volume, cpc, competitionSignal: competition },
      },
      confidence: volume !== undefined ? 0.74 : 0.55,
      capturedAt: new Date(),
    };
  }
}
