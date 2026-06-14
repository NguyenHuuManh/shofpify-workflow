/**
 * Purpose:
 * Business logic for Shopify integration.
 * Manages synchronization between platform and Shopify store.
 *
 * Responsibilities:
 * - Create draft products in Shopify
 * - Update Shopify product data
 * - Publish products to Shopify store
 * - Unpublish products
 * - Track synchronization state
 *
 * Architecture:
 * Service → Provider → Shopify API
 * This service coordinates, but actual API calls go through the provider layer.
 *
 * Dependencies:
 * - ShopifyResourceRepository
 * - ProductRepository
 * - AuditLogRepository
 * - AppError, logger
 */

import { shopifyResourceRepository } from '@/repositories/shopify-resource.repository';
import { productRepository } from '@/repositories/product.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { logger } from '@/lib/logger';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { ShopifyResource } from '@prisma/client';
import type { ShopifyResourceRepository } from '@/repositories/shopify-resource.repository';
import type { ProductRepository } from '@/repositories/product.repository';
import type { AuditLogRepository } from '@/repositories/audit-log.repository';

export class ShopifyService {
  constructor(
    private readonly shopifyRepo: ShopifyResourceRepository = shopifyResourceRepository,
    private readonly productRepo: ProductRepository = productRepository,
    private readonly auditRepo: AuditLogRepository = auditLogRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  async getByProductId(productId: string): Promise<ShopifyResource | null> {
    return this.shopifyRepo.findByProductId(productId);
  }

  async getPublished(): Promise<ShopifyResource[]> {
    return this.shopifyRepo.findPublished();
  }

  // ---------------------------------------------------------------------------
  // Sync Operations
  // ---------------------------------------------------------------------------

  /**
   * Create a draft product in Shopify.
   * Stores the Shopify product ID for future sync.
   *
   * Note: Actual Shopify API calls will be delegated to a ShopifyProvider
   * in Phase 4 (Agent Framework). For now, this records the intent.
   */
  async createDraft(
    productId: string,
    shopifyProductId: string,
    actorId?: string,
  ): Promise<ShopifyResource> {
    // Verify product exists and is APPROVED
    const product = await this.productRepo.findByIdOrThrow(productId);

    if (product.status !== 'APPROVED') {
      throw new AppError({
        code: ErrorCodes.PUBLISH_NOT_APPROVED,
        message: `Product '${product.title}' must be APPROVED before creating Shopify draft. Current status: ${product.status}`,
        statusCode: 400,
      });
    }

    const resource = await this.shopifyRepo.upsert(productId, {
      shopifyProductId,
      published: false,
    });

    await this.auditRepo.create({
      entityType: 'ShopifyResource',
      entityId: resource.id,
      action: 'SHOPIFY_DRAFT_CREATED',
      actorId,
      metadata: { productId, shopifyProductId },
    });

    logger.info({ productId, shopifyProductId }, 'Shopify draft created');
    return resource;
  }

  /**
   * Publish a product to the Shopify store.
   * Enforces the APPROVED requirement.
   */
  async publish(
    productId: string,
    shopifyProductId: string,
    actorId?: string,
  ): Promise<ShopifyResource> {
    // Verify product is APPROVED
    const product = await this.productRepo.findByIdOrThrow(productId);

    if (product.status !== 'APPROVED') {
      throw new AppError({
        code: ErrorCodes.PUBLISH_NOT_APPROVED,
        message: `Cannot publish. Product must be APPROVED. Current status: ${product.status}`,
        statusCode: 400,
      });
    }

    const resource = await this.shopifyRepo.upsert(productId, {
      shopifyProductId,
      published: true,
    });

    // Update product status to PUBLISHED
    await this.productRepo.updateStatus(productId, 'PUBLISHED');

    await this.auditRepo.create({
      entityType: 'ShopifyResource',
      entityId: resource.id,
      action: 'PRODUCT_PUBLISHED',
      actorId,
      metadata: { productId, shopifyProductId },
    });

    logger.info({ productId, shopifyProductId }, 'Product published to Shopify');
    return resource;
  }

  /**
   * Unpublish a product from Shopify.
   */
  async unpublish(productId: string, actorId?: string): Promise<ShopifyResource> {
    // Verify shopify resource exists
    await this.shopifyRepo.findByProductIdOrThrow(productId);

    const resource = await this.shopifyRepo.markUnpublished(productId);

    await this.auditRepo.create({
      entityType: 'ShopifyResource',
      entityId: resource.id,
      action: 'PRODUCT_UNPUBLISHED',
      actorId,
      metadata: { productId },
    });

    logger.info({ productId }, 'Product unpublished from Shopify');
    return resource;
  }

  /**
   * Update Shopify resource references.
   */
  async updateResource(
    productId: string,
    data: {
      shopifyProductId?: string;
      shopifyCollectionId?: string;
      shopifyPageId?: string;
    },
    actorId?: string,
  ): Promise<ShopifyResource> {
    const resource = await this.shopifyRepo.upsert(productId, data);

    await this.auditRepo.create({
      entityType: 'ShopifyResource',
      entityId: resource.id,
      action: 'SHOPIFY_RESOURCE_UPDATED',
      actorId,
      metadata: data,
    });

    logger.info({ productId }, 'Shopify resource updated');
    return resource;
  }
}

export const shopifyService = new ShopifyService();
