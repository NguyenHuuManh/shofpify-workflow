/**
 * Purpose:
 * ShopifyAgent — prepares product data for Shopify integration.
 * Does NOT call Shopify API directly — uses the ShopifyService.
 *
 * Architecture: Agent → Service Layer (ShopifyService) → Provider Layer → Shopify API
 *
 * Responsibilities:
 * - Prepare product data structure for Shopify
 * - Coordinate Shopify draft creation via ShopifyService
 * - Map platform data model to Shopify product fields
 *
 * Dependencies:
 * - ShopifyService (via services/)
 * - WorkflowContext types
 */

import { BaseAgent } from './base-agent';
import type { WorkflowContext } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';
import { shopifyService } from '@/services/shopify';
import { logger } from '@/lib/logger';

export class ShopifyAgent extends BaseAgent {
  readonly name = 'ShopifyAgent';

  constructor(aiProvider?: AIProvider) {
    super(aiProvider);
  }

  async execute(context: WorkflowContext): Promise<WorkflowContext> {
    logger.info({ workflowId: context.workflowId, productId: context.productId }, 'ShopifyAgent started');

    // Validate we have the required data
    if (!context.content) {
      throw new Error('ShopifyAgent: content data is required to create a Shopify draft');
    }
    if (!context.seo) {
      throw new Error('ShopifyAgent: SEO data is required to create a Shopify draft');
    }

    // Build Shopify product payload (for future API call via provider)
    const shopifyPayload = this.buildShopifyPayload(context);

    // Create draft via ShopifyService
    // Note: In production, the actual Shopify API call happens inside ShopifyService
    // which delegates to a ShopifyProvider (to be implemented in the provider layer)
    const resource = await shopifyService.createDraft(
      context.productId,
      `draft-${context.productId}`, // Placeholder: real ID comes from Shopify API response
    );

    logger.info(
      {
        workflowId: context.workflowId,
        productId: context.productId,
        shopifyResourceId: resource.id,
      },
      'ShopifyAgent completed',
    );

    return {
      ...context,
      // Attach Shopify payload for reference (future provider will use this)
      ...shopifyPayload,
    };
  }

  /**
   * Build the Shopify product payload from workflow context.
   * Maps platform data to Shopify's product schema.
   */
  private buildShopifyPayload(context: WorkflowContext): Record<string, unknown> {
    return {
      shopifyProductData: {
        title: context.content!.headline,
        body_html: context.content!.description,
        vendor: 'Autonomous Store',
        product_type: context.productIdea,
        status: 'draft',
        metafields_global_title_tag: context.seo!.metaTitle,
        metafields_global_description_tag: context.seo!.metaDescription,
        handle: context.seo!.slug,
        tags: context.seo!.keywords.join(', '),
        images: (context.imagePrompts ?? []).map((p) => ({
          src: p.prompt, // Placeholder: real image URL comes after image generation
          alt: p.description,
        })),
      },
    };
  }
}
