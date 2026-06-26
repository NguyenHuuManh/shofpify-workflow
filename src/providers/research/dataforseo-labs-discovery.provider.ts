/**
 * Purpose:
 * DataForSEO Labs autonomous root discovery provider.
 *
 * Responsibilities:
 * - Collect provider-backed broad category/keyword opportunities without
 *   relying on project hardcoded category seeds
 * - Normalize DataForSEO Labs Top Searches records into KEYWORD evidence
 * - Preserve product category provenance when DataForSEO returns it
 *
 * Dependencies:
 * - HttpResearchProvider
 * - DataForSEO Labs
 */

import { getOptionalEnvValue } from '@/lib/env';
import type { NormalizedResearchSourceInput } from '@/schemas/research.schema';
import type { ResearchProviderCollectInput } from '@/types/research.types';
import { HttpResearchProvider, type ResearchHttpRequest } from './base-research.provider';
import { buildDataForSeoRequest } from './dataforseo-client';

export class DataForSeoLabsDiscoveryProvider extends HttpResearchProvider {
  readonly name = 'DataForSeoLabsDiscoveryProvider';
  readonly providerType = 'keyword' as const;
  readonly discoveryRootProvider = true;

  private readonly login = getOptionalEnvValue('DATAFORSEO_LOGIN');
  private readonly password = getOptionalEnvValue('DATAFORSEO_PASSWORD');

  protected hasCredentials(): boolean {
    return Boolean(this.login && this.password);
  }

  protected missingConfigurationKey(): string {
    return 'DATAFORSEO_LOGIN/PASSWORD';
  }

  protected buildRequests(input: ResearchProviderCollectInput): ResearchHttpRequest[] {
    return [
      {
        url: 'https://api.dataforseo.com/v3/dataforseo_labs/google/top_searches/live',
        init: buildDataForSeoRequest([
          {
            location_name: input.config.targetMarket === 'US'
              ? 'United States'
              : input.config.targetMarket,
            language_name: 'English',
            limit: 100,
            order_by: ['keyword_info.search_volume,desc'],
          },
        ]),
        metadata: { endpoint: 'top_searches' },
      },
    ];
  }

  protected normalizeResponse(response: unknown): NormalizedResearchSourceInput[] {
    return this.extractKeywordRecords(response)
      .filter((record) => this.isCommercialKeyword(record.keyword))
      .slice(0, 40)
      .map((record) => this.normalizeDataForSeoLabsItem(record));
  }

  private extractKeywordRecords(value: unknown, depth = 0): LabsKeywordRecord[] {
    if (depth > 8) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => this.extractKeywordRecords(item, depth + 1));
    }

    const record = this.asRecord(value);
    if (Object.keys(record).length === 0) {
      return [];
    }

    const keywordData = this.asRecord(record.keyword_data);
    const keywordInfo = this.asRecord(record.keyword_info ?? keywordData.keyword_info);
    const keyword = this.stringOrUndefined(record.keyword) ??
      this.stringOrUndefined(keywordData.keyword);

    const current = keyword
      ? [{
          keyword,
          keywordInfo,
          rawRecord: record,
          categoryLabels: this.extractCategoryLabels(record),
        }]
      : [];

    const nested = [
      record.tasks,
      record.result,
      record.items,
      record.data,
      record.results,
      record.keyword_data,
    ].flatMap((item) => this.extractKeywordRecords(item, depth + 1));

    return [...current, ...nested];
  }

  private normalizeDataForSeoLabsItem(record: LabsKeywordRecord): NormalizedResearchSourceInput {
    const volume = this.numberOrUndefined(record.keywordInfo.search_volume);
    const cpc = this.numberOrUndefined(record.keywordInfo.cpc);
    const competition = this.numberOrUndefined(record.keywordInfo.competition_index);
    const categories = record.categoryLabels;

    return {
      type: 'KEYWORD',
      provider: 'DataForSEO Labs Top Searches',
      externalId: record.keyword,
      title: `${record.keyword} keyword signal`,
      extractedSignal: this.truncate(
        [
          `${record.keyword} autonomous discovery keyword`,
          volume !== undefined ? `search volume ${volume}` : undefined,
          cpc !== undefined ? `CPC ${cpc}` : undefined,
          competition !== undefined ? `competition ${competition}` : undefined,
          categories.length > 0 ? `categories ${categories.join(', ')}` : undefined,
        ].filter(Boolean).join(', '),
        2000,
      ),
      rawData: {
        ...record.rawRecord,
        keyword: record.keyword,
        categories,
        dataForSeoEndpoint: 'dataforseo_labs_google_top_searches',
        discoveryStage: 'autonomous_category_keyword_discovery',
        metrics: {
          searchVolume: volume,
          cpc,
          competitionSignal: competition,
        },
      },
      confidence: volume !== undefined ? 0.78 : 0.58,
      capturedAt: new Date(),
    };
  }

  private extractCategoryLabels(record: Record<string, unknown>): string[] {
    const categories = [
      record.categories,
      record.product_categories,
      this.asRecord(record.keyword_data).categories,
      this.asRecord(record.keyword_data).product_categories,
    ];

    return categories
      .flatMap((value) => Array.isArray(value) ? value : [])
      .map((value) => {
        if (typeof value === 'string' || typeof value === 'number') {
          return String(value);
        }
        const category = this.asRecord(value);
        return this.stringOrUndefined(category.name) ??
          this.stringOrUndefined(category.category_name) ??
          this.stringOrUndefined(category.label) ??
          this.stringOrUndefined(category.title) ??
          (typeof category.category === 'number' ? String(category.category) : undefined) ??
          (typeof category.category_code === 'number' ? String(category.category_code) : undefined);
      })
      .filter((value): value is string => Boolean(value))
      .filter((value, index, values) => values.indexOf(value) === index);
  }

  private isCommercialKeyword(keyword: string): boolean {
    const normalized = keyword.toLowerCase();
    const blocked = [
      'weather',
      'news',
      'lyrics',
      'movie',
      'song',
      'login',
      'facebook',
      'youtube',
      'gmail',
    ];
    if (blocked.some((token) => normalized.includes(token))) {
      return false;
    }

    const buyerIntentTokens = [
      'best',
      'buy',
      'deal',
      'for',
      'near me',
      'price',
      'review',
      'sale',
      'shop',
      'store',
    ];
    return buyerIntentTokens.some((token) => normalized.includes(token)) ||
      normalized.split(/\s+/).length >= 3;
  }
}

interface LabsKeywordRecord {
  keyword: string;
  keywordInfo: Record<string, unknown>;
  rawRecord: Record<string, unknown>;
  categoryLabels: string[];
}
