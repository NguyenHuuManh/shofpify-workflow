/**
 * Purpose:
 * Central barrel export for all repository instances.
 * Import from here to access any repository.
 *
 * Responsibilities:
 * - Provide a single import point for all repositories
 * - Enforce repository pattern usage throughout the application
 *
 * Dependencies:
 * - All individual repository modules
 */

export { BaseRepository } from './base.repository';
export type { TransactionClient } from './base.repository';

export { userRepository, UserRepository } from './user.repository';
export { productRepository, ProductRepository } from './product.repository';
export { productResearchRepository, ProductResearchRepository } from './product-research.repository';
export { researchProjectRepository, ResearchProjectRepository } from './research-project.repository';
export { researchRunRepository, ResearchRunRepository } from './research-run.repository';
export { productCandidateRepository, ProductCandidateRepository } from './product-candidate.repository';
export { researchSourceRepository, ResearchSourceRepository } from './research-source.repository';
export { productContentRepository, ProductContentRepository } from './product-content.repository';
export { productSEORepository, ProductSEORepository } from './product-seo.repository';
export { landingPageRepository, LandingPageRepository } from './landing-page.repository';
export { assetRepository, AssetRepository } from './asset.repository';
export { shopifyResourceRepository, ShopifyResourceRepository } from './shopify-resource.repository';
export { workflowRepository, WorkflowRepository } from './workflow.repository';
export { workflowStepRepository, WorkflowStepRepository } from './workflow-step.repository';
export { approvalRepository, ApprovalRepository } from './approval.repository';
export { agentRunRepository, AgentRunRepository } from './agent-run.repository';
export { aiUsageLogRepository, AIUsageLogRepository } from './ai-usage-log.repository';
export { auditLogRepository, AuditLogRepository } from './audit-log.repository';
export { settingRepository, SettingRepository } from './setting.repository';
