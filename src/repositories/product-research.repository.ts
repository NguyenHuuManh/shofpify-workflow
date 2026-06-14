/**
 * Purpose:
 * Data access layer for ProductResearch entities.
 * Stores AI-generated market research data.
 *
 * Responsibilities:
 * - CRUD operations for ProductResearch
 * - Upsert (research is regenerated per workflow run)
 *
 * Dependencies:
 * - @prisma/client
 * - @/lib/errors
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { ProductResearch } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class ProductResearchRepository extends BaseRepository {
  async findByProductId(
    productId: string,
    tx?: TransactionClient,
  ): Promise<ProductResearch | null> {
    const client = tx ?? this.db;
    return client.productResearch.findUnique({ where: { productId } });
  }

  async findByProductIdOrThrow(
    productId: string,
    tx?: TransactionClient,
  ): Promise<ProductResearch> {
    const research = await this.findByProductId(productId, tx);
    if (!research) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Research for product '${productId}' not found`,
        statusCode: 404,
      });
    }
    return research;
  }

  async upsert(
    productId: string,
    data: {
      targetAudience: Prisma.InputJsonValue;
      competitors: Prisma.InputJsonValue;
      painPoints: Prisma.InputJsonValue;
      usp: Prisma.InputJsonValue;
      marketSummary: string;
    },
    tx?: TransactionClient,
  ): Promise<ProductResearch> {
    const client = tx ?? this.db;
    return client.productResearch.upsert({
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
    await client.productResearch.deleteMany({ where: { productId } });
  }
}

export const productResearchRepository = new ProductResearchRepository();
