/**
 * Purpose:
 * Business logic for product management.
 * Coordinates between repositories and enforces domain rules.
 *
 * Responsibilities:
 * - Create products with validation
 * - Update product status and metadata
 * - Retrieve products with full relations
 * - Edit per-step generated content (research, content, SEO, landing)
 * - Audit all product mutations
 *
 * Dependencies:
 * - ProductRepository
 * - ProductResearchRepository
 * - ProductContentRepository
 * - ProductSEORepository
 * - LandingPageRepository
 * - AuditLogRepository
 * - Zod schemas (product.schema)
 * - AppError, logger
 */

import { productRepository } from '@/repositories/product.repository';
import { productResearchRepository } from '@/repositories/product-research.repository';
import { productContentRepository } from '@/repositories/product-content.repository';
import { productSEORepository } from '@/repositories/product-seo.repository';
import { landingPageRepository } from '@/repositories/landing-page.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { logger } from '@/lib/logger';
import { validate } from '@/lib/validate';
import {
  createProductSchema,
  updateProductSchema,
  productFilterSchema,
  updateResearchSchema,
  updateContentSchema,
  updateSeoSchema,
  updateLandingSchema,
} from '@/schemas/product.schema';
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductFilter,
  UpdateResearchInput,
  UpdateContentInput,
  UpdateSEOInput,
  UpdateLandingInput,
} from '@/schemas/product.schema';
import type { Prisma, Product, ProductStatus, ProductResearch, ProductContent, ProductSEO, LandingPage } from '@prisma/client';
import type { ProductRepository } from '@/repositories/product.repository';
import type { ProductResearchRepository } from '@/repositories/product-research.repository';
import type { ProductContentRepository } from '@/repositories/product-content.repository';
import type { ProductSEORepository } from '@/repositories/product-seo.repository';
import type { LandingPageRepository } from '@/repositories/landing-page.repository';
import type { AuditLogRepository } from '@/repositories/audit-log.repository';

export class ProductService {
  constructor(
    private readonly productRepo: ProductRepository = productRepository,
    private readonly auditRepo: AuditLogRepository = auditLogRepository,
    private readonly researchRepo: ProductResearchRepository = productResearchRepository,
    private readonly contentRepo: ProductContentRepository = productContentRepository,
    private readonly seoRepo: ProductSEORepository = productSEORepository,
    private readonly landingRepo: LandingPageRepository = landingPageRepository,
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
  // Per-Step Content Edit Operations
  // ---------------------------------------------------------------------------

  /**
   * Edit AI-generated research data for a product.
   * Merges the provided fields with existing data and persists.
   */
  async updateResearch(
    productId: string,
    input: UpdateResearchInput,
    actorId?: string,
  ): Promise<ProductResearch> {
    const parsed = validate(updateResearchSchema, input);

    // Get existing research to merge
    const existing = await this.researchRepo.findByProductIdOrThrow(productId);

    const merged = {
      targetAudience: (parsed.targetAudience ?? existing.targetAudience) as Prisma.InputJsonValue,
      competitors: (parsed.competitors ?? existing.competitors) as Prisma.InputJsonValue,
      painPoints: (parsed.painPoints ?? existing.painPoints) as Prisma.InputJsonValue,
      usp: (parsed.usp ?? existing.usp) as Prisma.InputJsonValue,
      marketSummary: parsed.marketSummary ?? existing.marketSummary,
      selectedCandidateId: existing.selectedCandidateId,
    };

    const updated = await this.researchRepo.upsert(productId, merged);

    await this.auditRepo.create({
      entityType: 'ProductResearch',
      entityId: updated.id,
      action: 'RESEARCH_EDITED',
      actorId,
      metadata: { productId, editedFields: Object.keys(parsed).filter((k) => parsed[k as keyof typeof parsed] !== undefined) },
    });

    logger.info({ productId, editedFields: Object.keys(parsed) }, 'Research edited via manual review');
    return updated;
  }

  /**
   * Edit AI-generated product content.
   */
  async updateContent(
    productId: string,
    input: UpdateContentInput,
    actorId?: string,
  ): Promise<ProductContent> {
    const parsed = validate(updateContentSchema, input);

    const existing = await this.contentRepo.findByProductIdOrThrow(productId);

    const merged = {
      headline: parsed.headline ?? existing.headline,
      subHeadline: parsed.subHeadline ?? existing.subHeadline ?? undefined,
      description: parsed.description ?? existing.description,
      benefits: (parsed.benefits ?? existing.benefits) as Prisma.InputJsonValue,
      features: (parsed.features ?? existing.features) as Prisma.InputJsonValue,
      faq: (parsed.faq ?? existing.faq) as Prisma.InputJsonValue,
    };

    const updated = await this.contentRepo.upsert(productId, merged);

    await this.auditRepo.create({
      entityType: 'ProductContent',
      entityId: updated.id,
      action: 'CONTENT_EDITED',
      actorId,
      metadata: { productId, editedFields: Object.keys(parsed).filter((k) => parsed[k as keyof typeof parsed] !== undefined) },
    });

    logger.info({ productId }, 'Content edited via manual review');
    return updated;
  }

  /**
   * Edit AI-generated SEO metadata.
   */
  async updateSEO(
    productId: string,
    input: UpdateSEOInput,
    actorId?: string,
  ): Promise<ProductSEO> {
    const parsed = validate(updateSeoSchema, input);

    const existing = await this.seoRepo.findByProductIdOrThrow(productId);

    const merged = {
      metaTitle: parsed.metaTitle ?? existing.metaTitle,
      metaDescription: parsed.metaDescription ?? existing.metaDescription,
      slug: parsed.slug ?? existing.slug,
      keywords: (parsed.keywords ?? existing.keywords) as Prisma.InputJsonValue,
    };

    const updated = await this.seoRepo.upsert(productId, merged);

    await this.auditRepo.create({
      entityType: 'ProductSEO',
      entityId: updated.id,
      action: 'SEO_EDITED',
      actorId,
      metadata: { productId, editedFields: Object.keys(parsed).filter((k) => parsed[k as keyof typeof parsed] !== undefined) },
    });

    logger.info({ productId }, 'SEO edited via manual review');
    return updated;
  }

  /**
   * Edit AI-generated landing page sections.
   */
  async updateLanding(
    productId: string,
    input: UpdateLandingInput,
    actorId?: string,
  ): Promise<LandingPage> {
    const parsed = validate(updateLandingSchema, input);

    const existing = await this.landingRepo.findByProductIdOrThrow(productId);

    const merged = {
      sections: (parsed.sections ?? existing.sections) as Prisma.InputJsonValue,
    };

    const updated = await this.landingRepo.upsert(productId, merged);

    await this.auditRepo.create({
      entityType: 'LandingPage',
      entityId: updated.id,
      action: 'LANDING_EDITED',
      actorId,
      metadata: { productId, editedFields: Object.keys(parsed).filter((k) => parsed[k as keyof typeof parsed] !== undefined) },
    });

    logger.info({ productId }, 'Landing page edited via manual review');
    return updated;
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
