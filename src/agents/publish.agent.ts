/**
 * Purpose:
 * PublishAgent — handles the final publishing step after human approval.
 * Publishes the product to Shopify and finalizes the workflow.
 *
 * Architecture: Agent → Service Layer (ShopifyService) → Provider Layer → Shopify API
 *
 * Responsibilities:
 * - Verify human approval status before publishing
 * - Publish product to Shopify via ShopifyService
 * - Finalize product status to PUBLISHED
 *
 * Dependencies:
 * - ShopifyService (via services/)
 * - WorkflowContext types
 */

import { BaseAgent } from './base-agent';
import type { WorkflowContext } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';
import { shopifyService } from '@/services/shopify';
import { productService } from '@/services/product.service';
import { logger } from '@/lib/logger';
import { AppError, ErrorCodes } from '@/lib/errors';

export class PublishAgent extends BaseAgent {
  readonly name = 'PublishAgent';

  constructor(aiProvider?: AIProvider) {
    super(aiProvider);
  }

  async execute(context: WorkflowContext): Promise<WorkflowContext> {
    logger.info({ workflowId: context.workflowId, productId: context.productId }, 'PublishAgent started');

    // Verify product is APPROVED before publishing
    const product = await productService.getById(context.productId);

    if (product.status !== 'APPROVED') {
      throw new AppError({
        code: ErrorCodes.PUBLISH_NOT_APPROVED,
        message: `Cannot publish product '${product.title}'. Status must be APPROVED, but is ${product.status}`,
        statusCode: 400,
      });
    }

    // Get the Shopify resource to verify it exists
    const shopifyResource = await shopifyService.getByProductId(context.productId);

    if (!shopifyResource?.shopifyProductId) {
      throw new AppError({
        code: ErrorCodes.PUBLISH_FAILED,
        message: `No Shopify draft found for product '${product.title}'. Run ShopifyAgent first.`,
        statusCode: 400,
      });
    }

    // Publish to Shopify via the service layer
    await shopifyService.publish(
      context.productId,
      shopifyResource.shopifyProductId,
    );

    logger.info(
      {
        workflowId: context.workflowId,
        productId: context.productId,
        shopifyProductId: shopifyResource.shopifyProductId,
      },
      'PublishAgent completed — product published',
    );

    return {
      ...context,
      published: true,
    } as WorkflowContext & { published: boolean };
  }
}
