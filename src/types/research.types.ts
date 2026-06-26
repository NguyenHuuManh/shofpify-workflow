/**
 * Purpose:
 * Shared Research Product Intelligence types.
 */

import type {
  ProductCandidate,
  ResearchDiscoveryJob,
  ResearchProject,
  ResearchRun,
  ResearchSource,
} from '@prisma/client';
import type {
  AutonomousDiscoveryJobConfig,
  DiscoveryJobResult,
  DiscoveryQueryPlan,
  CandidateScorePayload,
  NormalizedResearchSourceInput,
  ProductAggregationGroup,
  ProductAggregationSource,
  ProviderEvidenceMetrics,
  QueryIntelligenceCandidate,
  QueryIntelligenceResult,
  ResearchCandidateDraft,
  ResearchCollectionStage,
  ResearchRunConfig,
  ResearchRunConfigInput,
  SelectedDiscoveryQuery,
  SupplementalProviderName,
} from '@/schemas/research.schema';

export interface CandidateScoreResult {
  demandScore: number;
  trendScore: number;
  competitionScore: number;
  marginScore: number;
  supplierScore: number;
  sourcingScore: number;
  factoryCostScore: number;
  logisticsScore: number;
  creativePotentialScore: number;
  riskScore: number;
  winningScore: number;
  landedCost?: number;
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
  sourcing: number;
  factoryCost: number;
  logistics: number;
  creativePotential: number;
  risk: number;
}

export interface ResearchProviderCollectInput {
  productIdea: string;
  config: ResearchRunConfig;
  candidates?: ResearchCandidateDraft[];
  collectionContext?: ResearchCollectionContext;
}

export interface ResearchCollectionContext {
  stage: ResearchCollectionStage;
  queries: string[];
  selectedQueries?: SelectedDiscoveryQuery[];
  queryMetadata?: Record<string, SelectedDiscoveryQuery>;
  priorSources?: NormalizedResearchSourceInput[];
}

export interface ResearchProvider {
  readonly name: string;
  readonly providerType?: SupplementalProviderName;
  readonly discoveryRootProvider?: boolean;
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

export interface ProductAggregationInput {
  productIdea: string;
  sources: NormalizedResearchSourceInput[];
  maxGroups: number;
}

export interface ProductAggregationResult {
  groups: ProductAggregationGroup[];
  sources: ProductAggregationSource[];
  method: 'ai_grouping' | 'deterministic_dedup';
}

export interface QueryIntelligenceInput {
  productIdea: string;
  config: ResearchRunConfig;
  sources: NormalizedResearchSourceInput[];
}

export type {
  QueryIntelligenceCandidate,
  QueryIntelligenceResult,
  SelectedDiscoveryQuery,
};

export interface RunResearchInput {
  workflowId?: string;
  researchProjectId?: string;
  productId?: string;
  productIdea: string;
  config?: ResearchRunConfigInput;
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

export interface DiscoveryJobSummary {
  job: ResearchDiscoveryJob;
  project: ResearchProject;
}

export interface StartDiscoveryJobResult {
  researchProject: ResearchProject;
  discoveryJob: ResearchDiscoveryJob;
}

export interface ProductDiscoveryJobData {
  discoveryJobId: string;
}

export interface DiscoveryJobRunContext {
  job: ResearchDiscoveryJob;
  project: ResearchProject;
  config: AutonomousDiscoveryJobConfig;
  queryPlan: DiscoveryQueryPlan;
}

export interface DiscoveryJobRunResult {
  job: ResearchDiscoveryJob;
  result: DiscoveryJobResult;
}

// ---------------------------------------------------------------------------
// AI-Assisted Source Match Review types
// ---------------------------------------------------------------------------

export type SourceMatchStatus =
  | 'LIKELY_MATCH'
  | 'POTENTIAL_MATCH'
  | 'WEAK_MATCH'
  | 'NOT_A_MATCH'
  | 'INSUFFICIENT_EVIDENCE';

export type SourceMatchRecommendedAction =
  | 'LINK_AS_SOURCING_MATCH'
  | 'REVIEW_BEFORE_LINKING'
  | 'KEEP_SEPARATE'
  | 'FIND_BETTER_SOURCING_MATCH';

export type SourceMatchReviewerDecision =
  | 'CONFIRMED_MATCH'
  | 'REJECTED_MATCH'
  | 'NEEDS_BETTER_SOURCE';

export interface SourceMatchReviewResult {
  id: string;
  sourceId: string;
  matchedSourceId: string;
  matchStatus: SourceMatchStatus;
  confidenceScore: number;
  reasons: string[];
  warnings: string[];
  recommendedAction: SourceMatchRecommendedAction;
  reviewerDecision: SourceMatchReviewerDecision | null;
  reviewerId?: string;
  reviewerComment?: string;
  reviewedAt: string;
  decidedAt?: string;
}

// ---------------------------------------------------------------------------
// 1688 Sourcing Provider Adapter types
// ---------------------------------------------------------------------------

export type SourcingProviderVendor = 'dajiSaas' | 'apify';

export interface SourcingProviderAdapter {
  readonly vendor: SourcingProviderVendor;
  readonly name: string;

  /** Whether this adapter is configured with usable credentials. */
  isConfigured(): boolean;

  /**
   * Collect normalized SOURCING evidence from the vendor.
   * Must return an empty array when no usable evidence is found.
   */
  collect(input: ResearchProviderCollectInput): Promise<NormalizedResearchSourceInput[]>;
}

export interface SourcingFailoverResult {
  sources: NormalizedResearchSourceInput[];
  selectedVendor: SourcingProviderVendor | null;
  failoverReason: string | null;
}

// ---------------------------------------------------------------------------
// Sourcing Verification Workflow types
// ---------------------------------------------------------------------------

export type SourcingVerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'REJECTED'
  | 'NEEDS_MORE_INFO';

export interface SourcingVerificationResult {
  id: string;
  candidateId: string;
  reviewerId: string | null;
  status: SourcingVerificationStatus;
  notes: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;

  // Verification checklist
  factoryExists: boolean;
  moqConfirmed: boolean;
  priceReasonable: boolean;
  sampleAvailable: boolean;
  shippingFeasible: boolean;
  supplierResponsive: boolean;
}
