/**
 * Purpose:
 * Shared Research Product Intelligence types.
 */

import type {
  ProductCandidate,
  ResearchProject,
  ResearchRun,
  ResearchSource,
} from '@prisma/client';
import type {
  CandidateScorePayload,
  NormalizedResearchSourceInput,
  ProviderEvidenceMetrics,
  ResearchCandidateDraft,
  ResearchRunConfig,
  SupplementalProviderName,
} from '@/schemas/research.schema';

export interface CandidateScoreResult {
  demandScore: number;
  trendScore: number;
  competitionScore: number;
  marginScore: number;
  supplierScore: number;
  creativePotentialScore: number;
  riskScore: number;
  winningScore: number;
  estimatedGrossProfit?: number;
  grossMarginPercent?: number;
  breakEvenRoas?: number;
}

export interface CandidateScoringWeights {
  demand: number;
  trend: number;
  competition: number;
  margin: number;
  supplier: number;
  creativePotential: number;
  risk: number;
}

export interface ResearchProviderCollectInput {
  productIdea: string;
  config: ResearchRunConfig;
  candidates?: ResearchCandidateDraft[];
}

export interface ResearchProvider {
  readonly name: string;
  readonly providerType?: SupplementalProviderName;
  collect(input: ResearchProviderCollectInput): Promise<NormalizedResearchSourceInput[]>;
}

export interface SupplementalResearchProviderConfig {
  apiKey?: string;
  username?: string;
  password?: string;
  endpoint?: string;
  enabled?: boolean;
}

export interface NormalizedProviderEvidence {
  source: NormalizedResearchSourceInput;
  metrics?: ProviderEvidenceMetrics;
}

export interface RunResearchInput {
  workflowId?: string;
  researchProjectId?: string;
  productId?: string;
  productIdea: string;
  config?: Partial<ResearchRunConfig>;
}

export interface RunResearchResult {
  researchRun: ResearchRun;
  candidates: ProductCandidate[];
  sources: ResearchSource[];
  summary: string;
  recommendation: {
    bestCandidateId?: string;
    reason: string;
  };
}

export interface ResearchProjectSummary {
  project: ResearchProject;
  latestRunId: string | null;
  candidates: ProductCandidate[];
  selectedCandidate?: ProductCandidate;
}

export type ScoreCandidateInput = CandidateScorePayload;
