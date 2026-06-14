/**
 * Purpose:
 * Data access layer for LandingPage entities.
 * Stores AI-generated landing page sections.
 *
 * Responsibilities:
 * - CRUD operations for LandingPage
 * - Upsert (landing page is regenerated per workflow run)
 *
 * Dependencies:
 * - @prisma/client
 * - @/lib/errors
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { LandingPage } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class LandingPageRepository extends BaseRepository {
  async findByProductId(
    productId: string,
    tx?: TransactionClient,
  ): Promise<LandingPage | null> {
    const client = tx ?? this.db;
    return client.landingPage.findUnique({ where: { productId } });
  }

  async findByProductIdOrThrow(
    productId: string,
    tx?: TransactionClient,
  ): Promise<LandingPage> {
    const page = await this.findByProductId(productId, tx);
    if (!page) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Landing page for product '${productId}' not found`,
        statusCode: 404,
      });
    }
    return page;
  }

  async upsert(
    productId: string,
    data: { sections: Prisma.InputJsonValue },
    tx?: TransactionClient,
  ): Promise<LandingPage> {
    const client = tx ?? this.db;
    return client.landingPage.upsert({
      where: { productId },
      create: {
        productId,
        sections: data.sections,
        generatedAt: new Date(),
      },
      update: {
        sections: data.sections,
        generatedAt: new Date(),
      },
    });
  }

  async deleteByProductId(
    productId: string,
    tx?: TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.db;
    await client.landingPage.deleteMany({ where: { productId } });
  }
}

export const landingPageRepository = new LandingPageRepository();
