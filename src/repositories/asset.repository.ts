/**
 * Purpose:
 * Data access layer for Asset entities.
 * Stores references to generated images and media.
 *
 * Responsibilities:
 * - CRUD operations for Asset
 * - Type-based queries
 * - Bulk operations by product
 *
 * Dependencies:
 * - @prisma/client
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import type { Asset, AssetType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class AssetRepository extends BaseRepository {
  async findById(
    id: string,
    tx?: TransactionClient,
  ): Promise<Asset | null> {
    const client = tx ?? this.db;
    return client.asset.findUnique({ where: { id } });
  }

  async findByProductId(
    productId: string,
    tx?: TransactionClient,
  ): Promise<Asset[]> {
    const client = tx ?? this.db;
    return client.asset.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByType(
    productId: string,
    type: AssetType,
    tx?: TransactionClient,
  ): Promise<Asset[]> {
    const client = tx ?? this.db;
    return client.asset.findMany({
      where: { productId, type },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    data: {
      productId: string;
      type: AssetType;
      url: string;
      provider: string;
      metadata?: Prisma.InputJsonValue;
    },
    tx?: TransactionClient,
  ): Promise<Asset> {
    const client = tx ?? this.db;
    return client.asset.create({ data });
  }

  async createMany(
    assets: Array<{
      productId: string;
      type: AssetType;
      url: string;
      provider: string;
      metadata?: Prisma.InputJsonValue;
    }>,
    tx?: TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    const client = tx ?? this.db;
    return client.asset.createMany({ data: assets });
  }

  async delete(id: string, tx?: TransactionClient): Promise<Asset> {
    const client = tx ?? this.db;
    return client.asset.delete({ where: { id } });
  }

  async deleteByProductId(
    productId: string,
    tx?: TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    const client = tx ?? this.db;
    return client.asset.deleteMany({ where: { productId } });
  }
}

export const assetRepository = new AssetRepository();
