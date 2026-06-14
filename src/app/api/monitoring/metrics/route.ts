/**
 * Purpose:
 * Platform metrics API.
 * GET /api/monitoring/metrics — Get platform usage metrics
 *
 * Dependencies:
 * - AIUsageLogRepository
 * - ProductRepository
 * - WorkflowRepository
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { aiUsageLogRepository } from '@/repositories/ai-usage-log.repository';
import { productRepository } from '@/repositories/product.repository';
import { workflowRepository } from '@/repositories/workflow.repository';
import { success, handleError } from '../../api-helpers';

export async function GET(): Promise<NextResponse> {
  try {
    const [aiCost, productCount, workflowCount] = await Promise.all([
      aiUsageLogRepository.getTotalCost(),
      productRepository.count(),
      workflowRepository.count(),
    ]);

    const metrics = {
      ai: {
        totalCostUSD: Math.round(aiCost * 10000) / 10000,
      },
      products: {
        total: productCount,
      },
      workflows: {
        total: workflowCount,
      },
      timestamp: new Date().toISOString(),
    };

    return success(metrics);
  } catch (error) {
    return handleError(error);
  }
}
