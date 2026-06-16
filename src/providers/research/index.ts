/**
 * Purpose:
 * Research provider interfaces and default stub providers.
 *
 * Providers normalize external research data before it reaches services.
 * Stub providers are deliberately local and credential-free.
 */

import type {
  NormalizedResearchSourceInput,
} from '@/schemas/research.schema';
import type {
  ResearchProvider,
  ResearchProviderCollectInput,
} from '@/types/research.types';

abstract class StubResearchProvider implements ResearchProvider {
  abstract readonly name: string;
  protected abstract readonly sourceType: NormalizedResearchSourceInput['type'];

  async collect(
    input: ResearchProviderCollectInput,
  ): Promise<NormalizedResearchSourceInput[]> {
    if (process.env.ENABLE_RESEARCH_PROVIDER_STUBS !== 'true') {
      return [];
    }

    return [
      {
        type: this.sourceType,
        provider: this.name,
        extractedSignal: `${this.name} stub signal for "${input.productIdea}" in ${input.config.targetMarket}`,
        confidence: 0.25,
        capturedAt: new Date(),
        rawData: {
          stub: true,
          objective: input.config.objective,
        },
      },
    ];
  }
}

export class SearchResearchProviderStub extends StubResearchProvider {
  readonly name = 'SearchProviderStub';
  protected readonly sourceType = 'SEARCH';
}

export class MarketplaceResearchProviderStub extends StubResearchProvider {
  readonly name = 'MarketplaceProviderStub';
  protected readonly sourceType = 'MARKETPLACE';
}

export class TrendResearchProviderStub extends StubResearchProvider {
  readonly name = 'TrendProviderStub';
  protected readonly sourceType = 'TREND';
}

export class KeywordResearchProviderStub extends StubResearchProvider {
  readonly name = 'KeywordProviderStub';
  protected readonly sourceType = 'KEYWORD';
}

export class AdsSignalResearchProviderStub extends StubResearchProvider {
  readonly name = 'AdsSignalProviderStub';
  protected readonly sourceType = 'ADS_SIGNAL';
}

export class SupplierResearchProviderStub extends StubResearchProvider {
  readonly name = 'SupplierProviderStub';
  protected readonly sourceType = 'SUPPLIER';
}

export class SocialListeningResearchProviderStub extends StubResearchProvider {
  readonly name = 'SocialListeningProviderStub';
  protected readonly sourceType = 'SOCIAL';
}

export function createDefaultResearchProviders(): ResearchProvider[] {
  return [
    new SearchResearchProviderStub(),
    new MarketplaceResearchProviderStub(),
    new TrendResearchProviderStub(),
    new KeywordResearchProviderStub(),
    new AdsSignalResearchProviderStub(),
    new SupplierResearchProviderStub(),
    new SocialListeningResearchProviderStub(),
  ];
}

export type { ResearchProvider, ResearchProviderCollectInput };
