/**
 * Purpose:
 * Ads signal research provider.
 *
 * Responsibilities:
 * - Query approved ads libraries for active ad and creative angle signals
 * - Normalize ad evidence into ADS_SIGNAL ResearchSource payloads
 *
 * Dependencies:
 * - HttpResearchProvider
 * - optional Meta Ad Library token
 */

import { getOptionalEnvValue } from '@/lib/env';
import type { NormalizedResearchSourceInput } from '@/schemas/research.schema';
import type { ResearchProviderCollectInput } from '@/types/research.types';
import { HttpResearchProvider, type ResearchHttpRequest } from './base-research.provider';

export class AdsSignalResearchProvider extends HttpResearchProvider {
  readonly name = 'AdsSignalResearchProvider';
  readonly providerType = 'adsSignal' as const;

  private readonly accessToken = getOptionalEnvValue('META_AD_LIBRARY_ACCESS_TOKEN');

  protected hasCredentials(): boolean {
    return Boolean(this.accessToken);
  }

  protected missingConfigurationKey(): string {
    return 'META_AD_LIBRARY_ACCESS_TOKEN';
  }

  protected buildRequests(input: ResearchProviderCollectInput): ResearchHttpRequest[] {
    const url = new URL('https://graph.facebook.com/v20.0/ads_archive');
    url.searchParams.set('search_terms', input.productIdea);
    url.searchParams.set('ad_reached_countries', JSON.stringify([input.config.targetMarket]));
    url.searchParams.set('ad_type', 'ALL');
    url.searchParams.set('fields', 'id,ad_snapshot_url,page_name,ad_creative_bodies,ad_creative_link_titles');
    url.searchParams.set('access_token', this.accessToken ?? '');
    return [{ url: url.toString() }];
  }

  protected normalizeResponse(response: unknown): NormalizedResearchSourceInput[] {
    const root = this.asRecord(response);
    const data = Array.isArray(root.data) ? root.data : [];

    return data.slice(0, 10).map((item): NormalizedResearchSourceInput => {
      const record = this.asRecord(item);
      const bodies = Array.isArray(record.ad_creative_bodies)
        ? record.ad_creative_bodies.filter((value): value is string => typeof value === 'string')
        : [];
      const titles = Array.isArray(record.ad_creative_link_titles)
        ? record.ad_creative_link_titles.filter((value): value is string => typeof value === 'string')
        : [];
      const pageName = this.stringOrUndefined(record.page_name);

      return {
        type: 'ADS_SIGNAL',
        provider: 'Meta Ad Library',
        url: this.stringOrUndefined(record.ad_snapshot_url),
        externalId: this.stringOrUndefined(record.id),
        title: pageName ? `${pageName} ad signal` : 'Ad signal',
        extractedSignal: this.truncate(
          bodies[0] ?? titles[0] ?? 'Active ad matched the research query.',
          2000,
        ),
        rawData: {
          ...record,
          metrics: { creativeSignal: bodies.length > 0 || titles.length > 0 ? 70 : 50 },
        },
        confidence: 0.66,
        capturedAt: new Date(),
      };
    });
  }
}
