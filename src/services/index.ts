/**
 * Purpose:
 * Central barrel export for all service instances.
 * Import from here to access any service.
 *
 * Dependencies:
 * - All individual service modules
 */

export { productService, ProductService } from './product.service';
export { workflowService, WorkflowService } from './workflow.service';
export { approvalService, ApprovalService } from './approval.service';
export { assetService, AssetService } from './asset.service';
export { shopifyService, ShopifyService } from './shopify';
export { researchService, ResearchService } from './research.service';
export { discoveryJobService, DiscoveryJobService } from './discovery-job.service';
export { candidateSourcingService, CandidateSourcingService } from './candidate-sourcing.service';
export { candidateScoringService, CandidateScoringService } from './candidate-scoring.service';
export { sourceMatchingService, SourceMatchingService } from './source-matching.service';
export { sourcingVerificationService, SourcingVerificationService } from './sourcing-verification.service';
export { authService, AuthService } from './auth.service';
