/**
 * Purpose:
 * Unit tests for ProductService.
 * Tests business logic with mocked repositories.
 *
 * Dependencies:
 * - vitest
 * - ProductService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductService } from '@/services/product.service';
import { AppError } from '@/lib/errors';
import type { Product, ProductStatus } from '@prisma/client';

// Mock product
const mockProduct: Product = {
  id: 'prod_001',
  title: 'Portable Blender',
  status: 'DRAFT' as ProductStatus,
  workflowId: null,
  createdById: 'user_001',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('ProductService', () => {
  let service: ProductService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProductRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuditRepo: any;

  beforeEach(() => {
    mockProductRepo = {
      findByIdOrThrow: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
    };

    mockAuditRepo = {
      create: vi.fn(),
      findByEntity: vi.fn(),
      findByAction: vi.fn(),
      findRecent: vi.fn(),
    };

    service = new ProductService(mockProductRepo, mockAuditRepo);
  });

  // ---------------------------------------------------------------------------
  // getById
  // ---------------------------------------------------------------------------

  describe('getById', () => {
    it('should return product when found', async () => {
      mockProductRepo.findByIdOrThrow.mockResolvedValue(mockProduct);

      const result = await service.getById('prod_001');

      expect(result).toEqual(mockProduct);
      expect(mockProductRepo.findByIdOrThrow).toHaveBeenCalledWith('prod_001', {
        includeAll: true,
      });
    });

    it('should throw when product not found', async () => {
      mockProductRepo.findByIdOrThrow.mockRejectedValue(
        new AppError({ code: 'PRODUCT_NOT_FOUND', message: 'Not found', statusCode: 404 }),
      );

      await expect(service.getById('nonexistent')).rejects.toThrow(AppError);
    });
  });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------

  describe('list', () => {
    it('should return products with pagination', async () => {
      mockProductRepo.findMany.mockResolvedValue([mockProduct]);
      mockProductRepo.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, limit: 20 });

      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockProductRepo.findMany).toHaveBeenCalledWith({
        status: undefined,
        search: undefined,
        skip: 0,
        take: 20,
      });
    });

    it('should apply status filter', async () => {
      mockProductRepo.findMany.mockResolvedValue([]);
      mockProductRepo.count.mockResolvedValue(0);

      await service.list({ status: 'DRAFT', page: 1, limit: 10 });

      expect(mockProductRepo.findMany).toHaveBeenCalledWith({
        status: 'DRAFT',
        search: undefined,
        skip: 0,
        take: 10,
      });
    });

    it('should apply search filter', async () => {
      mockProductRepo.findMany.mockResolvedValue([mockProduct]);
      mockProductRepo.count.mockResolvedValue(1);

      await service.list({ search: 'Blender', page: 1, limit: 20 });

      expect(mockProductRepo.findMany).toHaveBeenCalledWith({
        status: undefined,
        search: 'Blender',
        skip: 0,
        take: 20,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('should create product with valid input', async () => {
      mockProductRepo.create.mockResolvedValue(mockProduct);
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.create({ title: 'Portable Blender' }, 'user_001');

      expect(result).toEqual(mockProduct);
      expect(mockProductRepo.create).toHaveBeenCalledWith({
        title: 'Portable Blender',
        createdById: 'user_001',
      });
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRODUCT_CREATED' }),
      );
    });

    it('should throw on empty title', async () => {
      await expect(service.create({ title: '' })).rejects.toThrow(AppError);
      expect(mockProductRepo.create).not.toHaveBeenCalled();
    });

    it('should throw on title exceeding max length', async () => {
      await expect(service.create({ title: 'a'.repeat(256) })).rejects.toThrow(AppError);
      expect(mockProductRepo.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('should update product title', async () => {
      mockProductRepo.update.mockResolvedValue({ ...mockProduct, title: 'Updated Blender' });
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.update('prod_001', { title: 'Updated Blender' }, 'user_001');

      expect(result.title).toBe('Updated Blender');
      expect(mockProductRepo.update).toHaveBeenCalledWith('prod_001', {
        title: 'Updated Blender',
        status: undefined,
        workflowId: undefined,
      });
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRODUCT_UPDATED' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // updateStatus
  // ---------------------------------------------------------------------------

  describe('updateStatus', () => {
    it('should update product status and audit', async () => {
      mockProductRepo.updateStatus.mockResolvedValue({
        ...mockProduct,
        status: 'APPROVED' as ProductStatus,
      });
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.updateStatus('prod_001', 'APPROVED', 'user_001');

      expect(result.status).toBe('APPROVED');
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PRODUCT_STATUS_CHANGED_TO_APPROVED',
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('should delete product and audit', async () => {
      mockProductRepo.delete.mockResolvedValue(mockProduct);
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.delete('prod_001', 'user_001');

      expect(result).toEqual(mockProduct);
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRODUCT_DELETED' }),
      );
    });
  });
});
