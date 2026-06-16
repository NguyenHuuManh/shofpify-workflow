/**
 * Purpose:
 * Shared TypeScript type definitions for the platform.
 * Centralizes all domain types used across services and repositories.
 *
 * Responsibilities:
 * - Re-export Prisma enums as TypeScript types
 * - Define DTO types for API boundaries
 * - Define workflow-related types
 * - Define per-step review types
 *
 * Dependencies:
 * - @prisma/client
 */

import type { Prisma, ProductCandidate } from '@prisma/client';

// Re-export all Prisma types for convenience
export type {
  User,
  Product,
  ProductResearch,
  ProductContent,
  ProductSEO,
  LandingPage,
  Asset,
  ShopifyResource,
  ResearchProject,
  ResearchRun,
  ProductCandidate,
  ResearchSource,
  Workflow,
  WorkflowStep,
  Approval,
  AgentRun,
  AIUsageLog,
  AuditLog,
  Setting,
} from '@prisma/client';

export {
  UserRole,
  ProductStatus,
  WorkflowStatus,
  WorkflowStepType,
  StepStatus,
  ApprovalStatus,
  AgentRunStatus,
  AssetType,
  ResearchSourceType,
  ResearchCandidateStatus,
  ResearchProjectStatus,
} from '@prisma/client';

export type {
  CandidateScoreResult,
  CandidateScoringWeights,
  ResearchProvider,
  ResearchProviderCollectInput,
  ResearchProjectSummary,
  RunResearchInput,
  RunResearchResult,
  ScoreCandidateInput,
} from './research.types';

// -----------------------------------------------------------------------------
// API DTOs
// -----------------------------------------------------------------------------

export interface CreateProductInput {
  title: string;
}

export interface CreateWorkflowInput {
  productId: string;
}

export interface ApprovalInput {
  status: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
  comment?: string;
}

// -----------------------------------------------------------------------------
// Per-Step Review Types
// -----------------------------------------------------------------------------

/**
 * Review step identifiers matching the intermediate review gates.
 */
export type ReviewStep = 'research' | 'content' | 'seo' | 'landing' | 'final';

/**
 * Decision on a single workflow step review.
 */
export interface ReviewDecision {
  /** Which review gate this decision applies to */
  step: ReviewStep;
  /** Review outcome */
  decision: 'APPROVED' | 'REJECTED';
  /** Required when rejecting */
  comment?: string;
  /** Reviewer user ID */
  reviewerId: string;
}

/**
 * Per-step review status stored on the workflow context.
 */
export interface StepReviewStatus {
  step: ReviewStep;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedAt?: string;
  reviewerId?: string;
  comment?: string;
  reworkCount: number;
}

// -----------------------------------------------------------------------------
// Workflow Context
// -----------------------------------------------------------------------------

/**
 * Data passed between workflow steps.
 * Accumulated as the workflow progresses through each agent.
 */
export interface WorkflowContext {
  workflowId: string;
  productId: string;
  productIdea: string;
  research?: ProductResearchResult;
  researchRunId?: string;
  productCandidates?: ProductCandidate[];
  content?: ProductContentResult;
  seo?: ProductSEOResult;
  landingPage?: LandingPageResult;
  imagePrompts?: ImagePrompt[];
  /** Per-step review tracking */
  reviews?: Record<ReviewStep, StepReviewStatus>;
}

export interface ProductResearchResult {
  targetAudience: Prisma.InputJsonValue;
  competitors: Prisma.InputJsonValue;
  painPoints: Prisma.InputJsonValue;
  usp: Prisma.InputJsonValue;
  marketSummary: string;
}

export interface ProductContentResult {
  headline: string;
  subHeadline?: string;
  description: string;
  benefits: Prisma.InputJsonValue;
  features: Prisma.InputJsonValue;
  faq: Prisma.InputJsonValue;
}

export interface ProductSEOResult {
  metaTitle: string;
  metaDescription: string;
  slug: string;
  keywords: string[];
}

export interface LandingPageResult {
  sections: Prisma.InputJsonValue;
}

export interface ImagePrompt {
  assetType: string;
  prompt: string;
  description: string;
}
