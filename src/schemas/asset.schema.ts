/**
 * Purpose:
 * Zod validation schemas for Asset service DTOs.
 *
 * Responsibilities:
 * - Validate asset creation
 * - Validate asset type
 *
 * Dependencies:
 * - zod
 */

import { z } from 'zod';

export const createAssetSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  type: z.enum(['HERO_IMAGE', 'PRODUCT_IMAGE', 'THUMBNAIL', 'AD_CREATIVE', 'LANDING_IMAGE']),
  url: z.string().url('Must be a valid URL'),
  provider: z.string().min(1, 'Provider is required'),
  metadata: z.any().optional(),
});

export const assetFilterSchema = z.object({
  type: z
    .enum(['HERO_IMAGE', 'PRODUCT_IMAGE', 'THUMBNAIL', 'AD_CREATIVE', 'LANDING_IMAGE'])
    .optional(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type AssetFilter = z.infer<typeof assetFilterSchema>;
