/**
 * Purpose:
 * Data access layer for Product entities.
 * Central business entity - the core of the platform.
 *
 * Responsibilities:
 * - CRUD operations for Product records
 * - Status-based queries and transitions
 * - Batch operations with pagination
 *
 * Dependencies:
 * - @prisma/client
 * - @/lib/errors
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { Product, ProductStatus, Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class ProductRepository extends BaseRepository {
  // Default includes for related data
  private readonly fullInclude = {
    research: true,
    content: true,
    seo: true,
    landingPage: true,
    assets: true,
    shopifyResource: true,
    createdBy: true,
  } satisfies Prisma.ProductInclude;

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  async findById(
    id: string,
    opts?: { includeAll?: boolean },
    tx?: TransactionClient,
  ): Promise<Product | null> {
    const client = tx ?? this.db;
    return client.product.findUnique({
      where: { id },
      include: opts?.includeAll ? this.fullInclude : undefined,
    });
  }

  async findByIdOrThrow(
    id: string,
    opts?: { includeAll?: boolean },
    tx?: TransactionClient,
  ): Promise<Product> {
    const product = await this.findById(id, opts, tx);
    if (!product) {
      throw new AppError({
        code: ErrorCodes.PRODUCT_NOT_FOUND,
        message: `Product with id '${id}' not found`,
        statusCode: 404,
      });
    }
    return product;
  }

  async findMany(
    filter?: {
      status?: ProductStatus;
      createdById?: string;
      search?: string;
      skip?: number;
      take?: number;
    },
    tx?: TransactionClient,
  ): Promise<Product[]> {
    const client = tx ?? this.db;
    const where: Prisma.ProductWhereInput = {};

    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.createdById) {
      where.createdById = filter.createdById;
    }
    if (filter?.search) {
      where.title = { contains: filter.search, mode: 'insensitive' };
    }

    return client.product.findMany({
      where,
      include: this.fullInclude,
      orderBy: { createdAt: 'desc' },
      skip: filter?.skip ?? 0,
      take: filter?.take ?? 20,
    });
  }

  async count(
    filter?: { status?: ProductStatus; createdById?: string },
    tx?: TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.db;
    const where: Prisma.ProductWhereInput = {};

    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.createdById) {
      where.createdById = filter.createdById;
    }

    return client.product.count({ where });
  }

  // ---------------------------------------------------------------------------
  // Write Operations
  // ---------------------------------------------------------------------------

  async create(
    data: { title: string; createdById?: string },
    tx?: TransactionClient,
  ): Promise<Product> {
    const client = tx ?? this.db;
    return client.product.create({
      data: {
        title: data.title,
        status: 'DRAFT',
        ...(data.createdById ? { createdById: data.createdById } : {}),
      },
    });
  }

  async update(
    id: string,
    data: Partial<Pick<Product, 'title' | 'status' | 'workflowId'>>,
    tx?: TransactionClient,
  ): Promise<Product> {
    const client = tx ?? this.db;

    await this.findByIdOrThrow(id, {}, tx);

    return client.product.update({
      where: { id },
      data,
    });
  }

  async updateStatus(
    id: string,
    status: ProductStatus,
    tx?: TransactionClient,
  ): Promise<Product> {
    const client = tx ?? this.db;

    await this.findByIdOrThrow(id, {}, tx);

    return client.product.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string, tx?: TransactionClient): Promise<Product> {
    const client = tx ?? this.db;

    await this.findByIdOrThrow(id, {}, tx);

    return client.product.delete({ where: { id } });
  }
}

export const productRepository = new ProductRepository();
