/**
 * Purpose:
 * Business logic for asset management.
 * Manages generated images and media references.
 *
 * Responsibilities:
 * - Create asset records
 * - Query assets by product and type
 * - Bulk operations
 * - Delete assets
 *
 * Dependencies:
 * - AssetRepository
 * - AuditLogRepository
 * - Zod schemas (asset.schema)
 * - AppError, logger
 */

import { assetRepository } from '@/repositories/asset.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { AppError, ErrorCodes } from '@/lib/errors';
import { validate } from '@/lib/validate';
import { createAssetSchema, assetFilterSchema } from '@/schemas/asset.schema';
import type { CreateAssetInput, AssetFilter } from '@/schemas/asset.schema';
import type { Asset, AssetType } from '@prisma/client';
import type { AssetRepository } from '@/repositories/asset.repository';
import type { AuditLogRepository } from '@/repositories/audit-log.repository';

export class AssetService {
  constructor(
    private readonly assetRepo: AssetRepository = assetRepository,
    private readonly auditRepo: AuditLogRepository = auditLogRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<Asset> {
    const asset = await this.assetRepo.findById(id);
    if (!asset) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Asset '${id}' not found`,
        statusCode: 404,
      });
    }
    return asset;
  }

  async getByProductId(
    productId: string,
    filter?: AssetFilter,
  ): Promise<Asset[]> {
    const parsed = filter ? validate(assetFilterSchema, filter) : undefined;

    if (parsed?.type) {
      return this.assetRepo.findByType(productId, parsed.type);
    }
    return this.assetRepo.findByProductId(productId);
  }

  // ---------------------------------------------------------------------------
  // Write Operations
  // ---------------------------------------------------------------------------

  async create(input: CreateAssetInput, actorId?: string): Promise<Asset> {
    const parsed = validate(createAssetSchema, input);

    const asset = await this.assetRepo.create({
      productId: parsed.productId,
      type: parsed.type,
      url: parsed.url,
      provider: parsed.provider,
      metadata: parsed.metadata,
    });

    await this.auditRepo.create({
      entityType: 'Asset',
      entityId: asset.id,
      action: 'ASSET_CREATED',
      actorId,
      metadata: {
        type: parsed.type,
        provider: parsed.provider,
        productId: parsed.productId,
      },
    });

    logger.info({ assetId: asset.id, type: parsed.type, productId: parsed.productId }, 'Asset created');
    return asset;
  }

  async createMany(
    assets: Array<{
      productId: string;
      type: AssetType;
      url: string;
      provider: string;
      metadata?: Prisma.InputJsonValue;
    }>,
    actorId?: string,
  ): Promise<{ count: number }> {
    const result = await this.assetRepo.createMany(assets);

    await this.auditRepo.create({
      entityType: 'Asset',
      entityId: assets[0]?.productId ?? 'unknown',
      action: 'ASSETS_BULK_CREATED',
      actorId,
      metadata: { count: result.count, types: assets.map((a) => a.type) },
    });

    logger.info({ count: result.count }, 'Assets bulk created');
    return { count: result.count };
  }

  async delete(id: string, actorId?: string): Promise<Asset> {
    const asset = await this.assetRepo.delete(id);

    await this.auditRepo.create({
      entityType: 'Asset',
      entityId: id,
      action: 'ASSET_DELETED',
      actorId,
      metadata: { productId: asset.productId, type: asset.type },
    });

    logger.info({ assetId: id }, 'Asset deleted');
    return asset;
  }

  async deleteByProductId(
    productId: string,
    actorId?: string,
  ): Promise<{ count: number }> {
    const result = await this.assetRepo.deleteByProductId(productId);

    await this.auditRepo.create({
      entityType: 'Asset',
      entityId: productId,
      action: 'ASSETS_DELETED_BY_PRODUCT',
      actorId,
      metadata: { count: result.count },
    });

    logger.info({ productId, count: result.count }, 'Assets deleted by product');
    return { count: result.count };
  }

  validateCreateInput(input: unknown): CreateAssetInput {
    return validate(createAssetSchema, input);
  }
}

export const assetService = new AssetService();
