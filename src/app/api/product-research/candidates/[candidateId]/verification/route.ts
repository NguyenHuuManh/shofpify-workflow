/**
 * Purpose:
 * Sourcing Verification API — get & update verification for a candidate.
 * GET  /api/product-research/candidates/:candidateId/verification
 * PUT  /api/product-research/candidates/:candidateId/verification
 */

import type { NextResponse } from 'next/server';
import { handleError, parseBody, success } from '../../../../api-helpers';
import { sourcingVerificationUpdateSchema } from '@/schemas/research.schema';
import { sourcingVerificationService } from '@/services/sourcing-verification.service';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: { candidateId: string } },
): Promise<NextResponse> {
  try {
    // Ensure a record exists (creates UNVERIFIED record if none)
    const { verification, candidate } =
      await sourcingVerificationService.ensureVerificationExists(params.candidateId);

    return success({
      verification: {
        id: verification.id,
        candidateId: verification.candidateId,
        status: verification.status,
        notes: verification.notes,
        verifiedAt: verification.verifiedAt?.toISOString() ?? null,
        reviewerId: verification.reviewerId,
        factoryExists: verification.factoryExists,
        moqConfirmed: verification.moqConfirmed,
        priceReasonable: verification.priceReasonable,
        sampleAvailable: verification.sampleAvailable,
        shippingFeasible: verification.shippingFeasible,
        supplierResponsive: verification.supplierResponsive,
        createdAt: verification.createdAt.toISOString(),
        updatedAt: verification.updatedAt.toISOString(),
      },
      candidate: {
        id: candidate.id,
        name: candidate.name,
        factoryUnitCost: candidate.factoryUnitCost,
        moq: candidate.moq,
        landedCost: candidate.landedCost,
        landedCostBreakdown: candidate.landedCostBreakdown,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { candidateId: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, sourcingVerificationUpdateSchema);
    const { verification, candidate } = await sourcingVerificationService.applyDecision(
      params.candidateId,
      body,
    );

    logger.info(
      {
        candidateId: params.candidateId,
        verificationId: verification.id,
        status: verification.status,
        reviewerId: body.reviewerId,
      },
      'Sourcing verification updated via API',
    );

    return success({
      verification: {
        id: verification.id,
        candidateId: verification.candidateId,
        status: verification.status,
        notes: verification.notes,
        verifiedAt: verification.verifiedAt?.toISOString() ?? null,
        reviewerId: verification.reviewerId,
        factoryExists: verification.factoryExists,
        moqConfirmed: verification.moqConfirmed,
        priceReasonable: verification.priceReasonable,
        sampleAvailable: verification.sampleAvailable,
        shippingFeasible: verification.shippingFeasible,
        supplierResponsive: verification.supplierResponsive,
        createdAt: verification.createdAt.toISOString(),
        updatedAt: verification.updatedAt.toISOString(),
      },
      candidate: {
        id: candidate.id,
        name: candidate.name,
        factoryUnitCost: candidate.factoryUnitCost,
        moq: candidate.moq,
        landedCost: candidate.landedCost,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
