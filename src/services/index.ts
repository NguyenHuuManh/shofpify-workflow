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
