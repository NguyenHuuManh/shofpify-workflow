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
 * - optional DataForSEO credentials
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

  protected hasCredentials(): boolean {
    return Boolean(this.login && this.password);
  }

  protected missingConfigurationKey(): string {
    return 'DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD';
  }

  protected buildRequests(input: ResearchProviderCollectInput): ResearchHttpRequest[] {
    return [
      {
        url: 'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
        init: buildDataForSeoRequest(
          [
            {
              keywords: [input.productIdea],
              location_name: input.config.targetMarket === 'US' ? 'United States' : input.config.targetMarket,
              language_name: 'English',
            },
          ],
        ),
      },
    ];
  }

  protected normalizeResponse(response: unknown, input: ResearchProviderCollectInput): NormalizedResearchSourceInput[] {
    const root = this.asRecord(response);
    const tasks = Array.isArray(root.tasks) ? root.tasks : [];
    const firstTask = this.asRecord(tasks[0]);
    const result = Array.isArray(firstTask.result) ? firstTask.result : [];

    return result.slice(0, 10).map((item): NormalizedResearchSourceInput => {
      const record = this.asRecord(item);
      const keyword = this.stringOrUndefined(record.keyword) ?? input.productIdea;
      const volume = this.numberOrUndefined(record.search_volume);
      const cpc = this.numberOrUndefined(record.cpc);
      const competition = this.numberOrUndefined(record.competition_index);

      return {
        type: 'KEYWORD',
        provider: 'DataForSEO Google Ads Search Volume',
        externalId: keyword,
        title: `${keyword} keyword signal`,
        extractedSignal: this.truncate(
          [
            `${keyword} keyword evidence`,
            volume !== undefined ? `search volume ${volume}` : undefined,
            cpc !== undefined ? `CPC ${cpc}` : undefined,
            competition !== undefined ? `competition index ${competition}` : undefined,
          ]
            .filter(Boolean)
            .join(', '),
          2000,
        ),
        rawData: {
          ...record,
          metrics: { searchVolume: volume, cpc, competitionSignal: competition },
        },
        confidence: 0.74,
        capturedAt: new Date(),
      };
    });
  }
}
