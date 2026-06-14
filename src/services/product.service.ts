/**
 * Purpose:
 * Business logic for product management.
 * Coordinates between repositories and enforces domain rules.
 *
 * Responsibilities:
 * - Create products with validation
 * - Update product status and metadata
 * - Retrieve products with full relations
 * - Audit all product mutations
 *
 * Dependencies:
 * - ProductRepository
 * - AuditLogRepository
 * - Zod schemas (product.schema)
 * - AppError, logger
 */

import { productRepository } from '@/repositories/product.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { logger } from '@/lib/logger';
import { validate } from '@/lib/validate';
import {
  createProductSchema,
  updateProductSchema,
  productFilterSchema,
} from '@/schemas/product.schema';
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductFilter,
} from '@/schemas/product.schema';
import type { Product, ProductStatus } from '@prisma/client';
import type { ProductRepository } from '@/repositories/product.repository';
import type { AuditLogRepository } from '@/repositories/audit-log.repository';

export class ProductService {
  constructor(
    private readonly productRepo: ProductRepository = productRepository,
    private readonly auditRepo: AuditLogRepository = auditLogRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<Product> {
    const product = await this.productRepo.findByIdOrThrow(id, { includeAll: true });
    logger.debug({ productId: id }, 'Product retrieved');
    return product;
  }

  async list(filter: ProductFilter): Promise<{ products: Product[]; total: number }> {
    const parsed = validate(productFilterSchema, filter);
    const skip = (parsed.page - 1) * parsed.limit;

    const [products, total] = await Promise.all([
      this.productRepo.findMany({
        status: parsed.status,
        search: parsed.search,
        skip,
        take: parsed.limit,
      }),
      this.productRepo.count({ status: parsed.status }),
    ]);

    logger.debug({ count: products.length, total }, 'Products listed');
    return { products, total };
  }

  // ---------------------------------------------------------------------------
  // Write Operations
  // ---------------------------------------------------------------------------

  async create(input: CreateProductInput, actorId?: string): Promise<Product> {
    const parsed = validate(createProductSchema, input);

    const product = await this.productRepo.create({
      title: parsed.title,
      createdById: actorId,
    });

    await this.auditRepo.create({
      entityType: 'Product',
      entityId: product.id,
      action: 'PRODUCT_CREATED',
      actorId,
      metadata: { title: parsed.title },
    });

    logger.info({ productId: product.id, title: parsed.title }, 'Product created');
    return product;
  }

  async update(
    id: string,
    input: UpdateProductInput,
    actorId?: string,
  ): Promise<Product> {
    const parsed = validate(updateProductSchema, input);

    const product = await this.productRepo.update(id, {
      title: parsed.title,
      status: parsed.status,
      workflowId: parsed.workflowId,
    });

    await this.auditRepo.create({
      entityType: 'Product',
      entityId: id,
      action: 'PRODUCT_UPDATED',
      actorId,
      metadata: parsed,
    });

    logger.info({ productId: id }, 'Product updated');
    return product;
  }

  async updateStatus(
    id: string,
    status: ProductStatus,
    actorId?: string,
  ): Promise<Product> {
    const product = await this.productRepo.updateStatus(id, status);

    await this.auditRepo.create({
      entityType: 'Product',
      entityId: id,
      action: `PRODUCT_STATUS_CHANGED_TO_${status}`,
      actorId,
      metadata: { previousStatus: product.status, newStatus: status },
    });

    logger.info({ productId: id, status }, 'Product status updated');
    return product;
  }

  async delete(id: string, actorId?: string): Promise<Product> {
    const product = await this.productRepo.delete(id);

    await this.auditRepo.create({
      entityType: 'Product',
      entityId: id,
      action: 'PRODUCT_DELETED',
      actorId,
      metadata: { title: product.title },
    });

    logger.info({ productId: id }, 'Product deleted');
    return product;
  }

  // ---------------------------------------------------------------------------
  // Validation Helpers
  // ---------------------------------------------------------------------------

  validateCreateInput(input: unknown): CreateProductInput {
    return validate(createProductSchema, input);
  }

  validateUpdateInput(input: unknown): UpdateProductInput {
    return validate(updateProductSchema, input);
  }
}

export const productService = new ProductService();
