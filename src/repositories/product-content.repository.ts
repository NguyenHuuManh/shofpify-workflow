/**
 * Purpose:
 * Data access layer for ProductContent entities.
 * Stores AI-generated product content (headline, description, FAQ, etc.).
 *
 * Responsibilities:
 * - CRUD operations for ProductContent
 * - Upsert (content is regenerated per workflow run)
 *
 * Dependencies:
 * - @prisma/client
 * - @/lib/errors
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { ProductContent } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class ProductContentRepository extends BaseRepository {
  async findByProductId(
    productId: string,
    tx?: TransactionClient,
  ): Promise<ProductContent | null> {
    const client = tx ?? this.db;
    return client.productContent.findUnique({ where: { productId } });
  }

  async findByProductIdOrThrow(
    productId: string,
    tx?: TransactionClient,
  ): Promise<ProductContent> {
    const content = await this.findByProductId(productId, tx);
    if (!content) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Content for product '${productId}' not found`,
        statusCode: 404,
      });
    }
    return content;
  }

  async upsert(
    productId: string,
    data: {
      headline: string;
      subHeadline?: string;
      description: string;
      benefits: Prisma.InputJsonValue;
      features: Prisma.InputJsonValue;
      faq: Prisma.InputJsonValue;
    },
    tx?: TransactionClient,
  ): Promise<ProductContent> {
    const client = tx ?? this.db;
    return client.productContent.upsert({
      where: { productId },
      create: {
        productId,
        ...data,
        generatedAt: new Date(),
      },
      update: {
        ...data,
        generatedAt: new Date(),
      },
    });
  }

  async deleteByProductId(
    productId: string,
    tx?: TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.db;
    await client.productContent.deleteMany({ where: { productId } });
  }
}

export const productContentRepository = new ProductContentRepository();
