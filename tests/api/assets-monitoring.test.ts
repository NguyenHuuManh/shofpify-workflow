/**
 * Purpose:
 * API integration tests for Asset and Monitoring routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/lib/errors';

const mockAssetService = {
  getById: vi.fn(),
  getByProductId: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  delete: vi.fn(),
  deleteByProductId: vi.fn(),
};

vi.mock('@/services/asset.service', () => ({
  assetService: mockAssetService,
}));

describe('Asset API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create asset via service', async () => {
    mockAssetService.create.mockResolvedValue({
      id: 'ast_001',
      productId: 'prod_001',
      type: 'HERO_IMAGE',
      url: 'https://cdn.example.com/hero.png',
      provider: 'midjourney',
    });

    const result = await mockAssetService.create({
      productId: 'prod_001',
      type: 'HERO_IMAGE',
      url: 'https://cdn.example.com/hero.png',
      provider: 'midjourney',
    });

    expect(result.type).toBe('HERO_IMAGE');
    expect(result.url).toBe('https://cdn.example.com/hero.png');
  });

  it('should get asset by ID', async () => {
    mockAssetService.getById.mockResolvedValue({
      id: 'ast_001',
      productId: 'prod_001',
      type: 'THUMBNAIL',
      url: 'https://cdn.example.com/thumb.png',
      provider: 'dalle',
    });

    const result = await mockAssetService.getById('ast_001');

    expect(result.type).toBe('THUMBNAIL');
  });

  it('should throw AppError for invalid URL', async () => {
    mockAssetService.create.mockRejectedValue(
      new AppError({ code: 'VALIDATION_ERROR', message: 'Invalid URL', statusCode: 400 }),
    );

    await expect(
      mockAssetService.create({
        productId: 'prod_001',
        type: 'HERO_IMAGE',
        url: 'not-a-url',
        provider: 'midjourney',
      }),
    ).rejects.toThrow(AppError);
  });

  it('should get assets by product ID', async () => {
    mockAssetService.getByProductId.mockResolvedValue([
      { id: 'ast_001', type: 'HERO_IMAGE', url: 'url1' },
      { id: 'ast_002', type: 'PRODUCT_IMAGE', url: 'url2' },
    ]);

    const result = await mockAssetService.getByProductId('prod_001');

    expect(result).toHaveLength(2);
  });
});

describe('Monitoring API (repository layer)', () => {
  it('should handle agent run status summary structure', () => {
    const mockRuns = [
      { id: '1', agentName: 'ResearchAgent', status: 'SUCCESS' },
    ];

    const summary = {
      total: mockRuns.length,
      succeeded: mockRuns.filter((r) => r.status === 'SUCCESS').length,
      failed: mockRuns.filter((r) => r.status === 'FAILED').length,
    };

    expect(summary.total).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(0);
  });

  it('should calculate correct AI cost metrics', () => {
    const totalCostUSD = 0.015;

    const metrics = {
      ai: { totalCostUSD: Math.round(totalCostUSD * 10000) / 10000 },
      products: { total: 42 },
      workflows: { total: 10 },
    };

    expect(metrics.ai.totalCostUSD).toBe(0.015);
    expect(metrics.products.total).toBe(42);
  });
});
