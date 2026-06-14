/**
 * Purpose:
 * Unit tests for AssetService.
 *
 * Dependencies:
 * - vitest
 * - AssetService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssetService } from '@/services/asset.service';
import { AppError } from '@/lib/errors';
import type { Asset, AssetType } from '@prisma/client';

const mockAsset: Asset = {
  id: 'ast_001',
  productId: 'prod_001',
  type: 'HERO_IMAGE' as AssetType,
  url: 'https://cdn.example.com/hero.png',
  provider: 'midjourney',
  metadata: { prompt: 'portable blender hero' },
  createdAt: new Date('2026-01-01'),
};

describe('AssetService', () => {
  let service: AssetService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAssetRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuditRepo: any;

  beforeEach(() => {
    mockAssetRepo = {
      findById: vi.fn(),
      findByProductId: vi.fn(),
      findByType: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
      deleteByProductId: vi.fn(),
    };

    mockAuditRepo = {
      create: vi.fn(),
      findByEntity: vi.fn(),
      findByAction: vi.fn(),
      findRecent: vi.fn(),
    };

    service = new AssetService(mockAssetRepo, mockAuditRepo);
  });

  // ---------------------------------------------------------------------------
  // getById
  // ---------------------------------------------------------------------------

  describe('getById', () => {
    it('should return asset when found', async () => {
      mockAssetRepo.findById.mockResolvedValue(mockAsset);

      const result = await service.getById('ast_001');

      expect(result).toEqual(mockAsset);
    });

    it('should throw when asset not found', async () => {
      mockAssetRepo.findById.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(AppError);
    });
  });

  // ---------------------------------------------------------------------------
  // getByProductId
  // ---------------------------------------------------------------------------

  describe('getByProductId', () => {
    it('should return assets for product', async () => {
      mockAssetRepo.findByProductId.mockResolvedValue([mockAsset]);

      const result = await service.getByProductId('prod_001');

      expect(result).toHaveLength(1);
      expect(mockAssetRepo.findByProductId).toHaveBeenCalledWith('prod_001');
    });

    it('should filter by type when specified', async () => {
      mockAssetRepo.findByType.mockResolvedValue([mockAsset]);

      const result = await service.getByProductId('prod_001', { type: 'HERO_IMAGE' });

      expect(result).toHaveLength(1);
      expect(mockAssetRepo.findByType).toHaveBeenCalledWith('prod_001', 'HERO_IMAGE');
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('should create asset and audit', async () => {
      mockAssetRepo.create.mockResolvedValue(mockAsset);
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.create(
        {
          productId: 'prod_001',
          type: 'HERO_IMAGE',
          url: 'https://cdn.example.com/hero.png',
          provider: 'midjourney',
        },
        'user_001',
      );

      expect(result).toEqual(mockAsset);
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ASSET_CREATED' }),
      );
    });

    it('should throw on invalid URL', async () => {
      await expect(
        service.create({
          productId: 'prod_001',
          type: 'HERO_IMAGE',
          url: 'not-a-url',
          provider: 'midjourney',
        }),
      ).rejects.toThrow(AppError);
    });

    it('should throw on invalid asset type', async () => {
      await expect(
        service.create({
          productId: 'prod_001',
          type: 'INVALID' as AssetType,
          url: 'https://cdn.example.com/hero.png',
          provider: 'midjourney',
        }),
      ).rejects.toThrow(AppError);
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('should delete asset and audit', async () => {
      mockAssetRepo.delete.mockResolvedValue(mockAsset);
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.delete('ast_001', 'user_001');

      expect(result).toEqual(mockAsset);
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ASSET_DELETED' }),
      );
    });
  });
});
