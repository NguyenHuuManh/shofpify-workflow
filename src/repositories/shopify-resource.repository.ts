/**
 * Purpose:
 * Data access layer for ShopifyResource entities.
 * Tracks synchronization between local products and Shopify store.
 *
 * Responsibilities:
 * - CRUD operations for ShopifyResource
 * - Published state management
 * - Shopify ID tracking
 *
 * Dependencies:
 * - @prisma/client
 * - @/lib/errors
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { ShopifyResource, Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class ShopifyResourceRepository extends BaseRepository {
  async findByProductId(
    productId: string,
    tx?: TransactionClient,
  ): Promise<ShopifyResource | null> {
    const client = tx ?? this.db;
    return client.shopifyResource.findUnique({ where: { productId } });
  }

  async findByProductIdOrThrow(
    productId: string,
    tx?: TransactionClient,
  ): Promise<ShopifyResource> {
    const resource = await this.findByProductId(productId, tx);
    if (!resource) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Shopify resource for product '${productId}' not found`,
        statusCode: 404,
      });
    }
    return resource;
  }

  async findPublished(
    tx?: TransactionClient,
  ): Promise<ShopifyResource[]> {
    const client = tx ?? this.db;
    return client.shopifyResource.findMany({
      where: { published: true },
      orderBy: { syncedAt: 'desc' },
    });
  }

  async upsert(
    productId: string,
    data: {
      shopifyProductId?: string;
      shopifyCollectionId?: string;
      shopifyPageId?: string;
      published?: boolean;
    },
    tx?: TransactionClient,
  ): Promise<ShopifyResource> {
    const client = tx ?? this.db;

    const updateData: Prisma.ShopifyResourceUpdateInput = { ...data };
    if (data.shopifyProductId || data.shopifyCollectionId || data.shopifyPageId) {
      updateData.syncedAt = new Date();
    }

    return client.shopifyResource.upsert({
      where: { productId },
      create: {
        productId,
        ...data,
        syncedAt: new Date(),
      },
      update: updateData,
    });
  }

  async markPublished(
    productId: string,
    tx?: TransactionClient,
  ): Promise<ShopifyResource> {
    const client = tx ?? this.db;

    await this.findByProductIdOrThrow(productId, tx);

    return client.shopifyResource.update({
      where: { productId },
      data: { published: true, syncedAt: new Date() },
    });
  }

  async markUnpublished(
    productId: string,
    tx?: TransactionClient,
  ): Promise<ShopifyResource> {
    const client = tx ?? this.db;

    await this.findByProductIdOrThrow(productId, tx);

    return client.shopifyResource.update({
      where: { productId },
      data: { published: false, syncedAt: new Date() },
    });
  }

  async deleteByProductId(
    productId: string,
    tx?: TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.db;
    await client.shopifyResource.deleteMany({ where: { productId } });
  }
}

export const shopifyResourceRepository = new ShopifyResourceRepository();
