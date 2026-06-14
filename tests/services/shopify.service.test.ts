/**
 * Purpose:
 * Unit tests for ShopifyService.
 * Tests Shopify integration business logic with mocked repositories.
 *
 * Dependencies:
 * - vitest
 * - ShopifyService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShopifyService } from '@/services/shopify/shopify.service';
import { AppError } from '@/lib/errors';
import type { ShopifyResource, Product, ProductStatus } from '@prisma/client';

const mockProduct: Product = {
  id: 'prod_001',
  title: 'Portable Blender',
  status: 'APPROVED' as ProductStatus,
  workflowId: 'wf_001',
  createdById: 'user_001',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockResource: ShopifyResource = {
  id: 'shr_001',
  productId: 'prod_001',
  shopifyProductId: 'shop_12345',
  shopifyCollectionId: null,
  shopifyPageId: null,
  published: false,
  syncedAt: new Date('2026-01-01'),
};

describe('ShopifyService', () => {
  let service: ShopifyService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockShopifyRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProductRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuditRepo: any;

  beforeEach(() => {
    mockShopifyRepo = {
      findByProductId: vi.fn(),
      findByProductIdOrThrow: vi.fn(),
      findPublished: vi.fn(),
      upsert: vi.fn(),
      markPublished: vi.fn(),
      markUnpublished: vi.fn(),
      deleteByProductId: vi.fn(),
    };

    mockProductRepo = {
      findByIdOrThrow: vi.fn(),
      findById: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
    };

    mockAuditRepo = {
      create: vi.fn(),
      findByEntity: vi.fn(),
      findByAction: vi.fn(),
      findRecent: vi.fn(),
    };

    service = new ShopifyService(
      mockShopifyRepo,
      mockProductRepo,
      mockAuditRepo,
    );
  });

  // ---------------------------------------------------------------------------
  // createDraft
  // ---------------------------------------------------------------------------

  describe('createDraft', () => {
    it('should create draft when product is APPROVED', async () => {
      mockProductRepo.findByIdOrThrow.mockResolvedValue(mockProduct);
      mockShopifyRepo.upsert.mockResolvedValue(mockResource);
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.createDraft('prod_001', 'shop_12345', 'user_001');

      expect(result).toEqual(mockResource);
      expect(mockShopifyRepo.upsert).toHaveBeenCalledWith('prod_001', {
        shopifyProductId: 'shop_12345',
        published: false,
      });
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SHOPIFY_DRAFT_CREATED' }),
      );
    });

    it('should throw when product is not APPROVED', async () => {
      mockProductRepo.findByIdOrThrow.mockResolvedValue({
        ...mockProduct,
        status: 'DRAFT',
      } as Product);

      await expect(
        service.createDraft('prod_001', 'shop_12345'),
      ).rejects.toThrow(AppError);
      expect(mockShopifyRepo.upsert).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // publish
  // ---------------------------------------------------------------------------

  describe('publish', () => {
    it('should publish when product is APPROVED', async () => {
      mockProductRepo.findByIdOrThrow.mockResolvedValue(mockProduct);
      mockShopifyRepo.upsert.mockResolvedValue({
        ...mockResource,
        published: true,
      });
      mockProductRepo.updateStatus.mockResolvedValue({});
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.publish('prod_001', 'shop_12345', 'user_001');

      expect(result.published).toBe(true);
      expect(mockProductRepo.updateStatus).toHaveBeenCalledWith('prod_001', 'PUBLISHED');
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRODUCT_PUBLISHED' }),
      );
    });

    it('should throw when product is not APPROVED', async () => {
      mockProductRepo.findByIdOrThrow.mockResolvedValue({
        ...mockProduct,
        status: 'DRAFT',
      } as Product);

      await expect(
        service.publish('prod_001', 'shop_12345'),
      ).rejects.toThrow(AppError);
      expect(mockShopifyRepo.upsert).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // unpublish
  // ---------------------------------------------------------------------------

  describe('unpublish', () => {
    it('should unpublish product', async () => {
      mockShopifyRepo.findByProductIdOrThrow.mockResolvedValue(mockResource);
      mockShopifyRepo.markUnpublished.mockResolvedValue({
        ...mockResource,
        published: false,
      });
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.unpublish('prod_001', 'user_001');

      expect(result.published).toBe(false);
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRODUCT_UNPUBLISHED' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getPublished
  // ---------------------------------------------------------------------------

  describe('getPublished', () => {
    it('should return published resources', async () => {
      mockShopifyRepo.findPublished.mockResolvedValue([
        { ...mockResource, published: true },
      ]);

      const result = await service.getPublished();

      expect(result).toHaveLength(1);
      expect(result[0]!.published).toBe(true);
    });
  });
});
