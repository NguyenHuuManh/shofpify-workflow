/**
 * Purpose:
 * Data access layer for ProductSEO entities.
 * Stores AI-generated SEO metadata (title, description, slug, keywords).
 *
 * Responsibilities:
 * - CRUD operations for ProductSEO
 * - Slug uniqueness enforcement
 * - Upsert (SEO is regenerated per workflow run)
 *
 * Dependencies:
 * - @prisma/client
 * - @/lib/errors
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { ProductSEO } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class ProductSEORepository extends BaseRepository {
  async findByProductId(
    productId: string,
    tx?: TransactionClient,
  ): Promise<ProductSEO | null> {
    const client = tx ?? this.db;
    return client.productSEO.findUnique({ where: { productId } });
  }

  async findBySlug(
    slug: string,
    tx?: TransactionClient,
  ): Promise<ProductSEO | null> {
    const client = tx ?? this.db;
    return client.productSEO.findUnique({ where: { slug } });
  }

  async findByProductIdOrThrow(
    productId: string,
    tx?: TransactionClient,
  ): Promise<ProductSEO> {
    const seo = await this.findByProductId(productId, tx);
    if (!seo) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `SEO for product '${productId}' not found`,
        statusCode: 404,
      });
    }
    return seo;
  }

  async upsert(
    productId: string,
    data: {
      metaTitle: string;
      metaDescription: string;
      slug: string;
      keywords: Prisma.InputJsonValue;
    },
    tx?: TransactionClient,
  ): Promise<ProductSEO> {
    const client = tx ?? this.db;

    // Check slug uniqueness if it differs from current
    const existing = await client.productSEO.findUnique({ where: { productId } });
    if (existing && existing.slug !== data.slug) {
      const slugConflict = await client.productSEO.findUnique({
        where: { slug: data.slug },
      });
      if (slugConflict) {
        throw new AppError({
          code: ErrorCodes.VALIDATION_ERROR,
          message: `Slug '${data.slug}' is already in use`,
          statusCode: 409,
        });
      }
    }

    return client.productSEO.upsert({
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
    await client.productSEO.deleteMany({ where: { productId } });
  }
}

export const productSEORepository = new ProductSEORepository();
