/**
 * Purpose:
 * Research provider registry for supplemental evidence collection.
 *
 * Responsibilities:
 * - Export approved research provider implementations
 * - Create the default supplemental provider list
 * - Avoid fake evidence when providers are not configured
 *
 * Dependencies:
 * - Research provider implementations
 */

import type {
  ResearchProvider,
  ResearchProviderCollectInput,
} from '@/types/research.types';
import { AdsSignalResearchProvider } from './ads-signal.provider';
import { KeywordResearchProvider } from './keyword.provider';
import { MarketplaceResearchProvider } from './marketplace.provider';
import { SearchResearchProvider } from './search.provider';
import { SupplierResearchProvider } from './supplier.provider';
import { TrendResearchProvider } from './trend.provider';

export { AdsSignalResearchProvider } from './ads-signal.provider';
export { KeywordResearchProvider } from './keyword.provider';
export { MarketplaceResearchProvider } from './marketplace.provider';
export { SearchResearchProvider } from './search.provider';
export { SupplierResearchProvider } from './supplier.provider';
export { TrendResearchProvider } from './trend.provider';

export function createDefaultResearchProviders(): ResearchProvider[] {
  return [
    new SearchResearchProvider(),
    new MarketplaceResearchProvider(),
    new TrendResearchProvider(),
    new KeywordResearchProvider(),
    new AdsSignalResearchProvider(),
    new SupplierResearchProvider(),
  ];
}

export type { ResearchProvider, ResearchProviderCollectInput };
