/**
 * Purpose:
 * Shared TypeScript type definitions for the platform.
 * Centralizes all domain types used across services and repositories.
 *
 * Responsibilities:
 * - Re-export Prisma enums as TypeScript types
 * - Define DTO types for API boundaries
 * - Define workflow-related types
 *
 * Dependencies:
 * - @prisma/client
 */

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
} from '@prisma/client';

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
  content?: ProductContentResult;
  seo?: ProductSEOResult;
  landingPage?: LandingPageResult;
  imagePrompts?: ImagePrompt[];
}

export interface ProductResearchResult {
  targetAudience: Record<string, unknown>;
  competitors: Record<string, unknown>;
  painPoints: Record<string, unknown>;
  usp: Record<string, unknown>;
  marketSummary: string;
}

export interface ProductContentResult {
  headline: string;
  subHeadline?: string;
  description: string;
  benefits: Record<string, unknown>;
  features: Record<string, unknown>;
  faq: Record<string, unknown>;
}

export interface ProductSEOResult {
  metaTitle: string;
  metaDescription: string;
  slug: string;
  keywords: string[];
}

export interface LandingPageResult {
  sections: Record<string, unknown>;
}

export interface ImagePrompt {
  assetType: string;
  prompt: string;
  description: string;
}
