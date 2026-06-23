/**
 * Purpose:
 * Data access layer for SourcingVerification entities.
 *
 * Responsibilities:
 * - Persist verification records for candidate sourcing data
 * - Fetch verification status by candidate
 * - Update verification checklist and status
 *
 * Dependencies:
 * - @prisma/client
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type {
  Prisma,
  SourcingVerification,
  SourcingVerificationStatus,
} from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class SourcingVerificationRepository extends BaseRepository {
  /**
   * Create a new sourcing verification record for a candidate.
   * Default status is UNVERIFIED with all checklist items false.
   */
  async create(
    data: {
      candidateId: string;
      reviewerId?: string;
    },
    tx?: TransactionClient,
  ): Promise<SourcingVerification> {
    const client = tx ?? this.db;

    const existing = await client.sourcingVerification.findUnique({
      where: { candidateId: data.candidateId },
    });

    if (existing) {
      throw new AppError({
        code: ErrorCodes.CONFLICT,
        message: `Sourcing verification already exists for candidate '${data.candidateId}'`,
        statusCode: 409,
      });
    }

    return client.sourcingVerification.create({
      data: {
        candidateId: data.candidateId,
        reviewerId: data.reviewerId,
        status: 'UNVERIFIED',
        factoryExists: false,
        moqConfirmed: false,
        priceReasonable: false,
        sampleAvailable: false,
        shippingFeasible: false,
        supplierResponsive: false,
      },
    });
  }

  /**
   * Find or create a verification record for a candidate.
   * Safe upsert for API callers that just want the record.
   */
  async findOrCreate(
    candidateId: string,
    tx?: TransactionClient,
  ): Promise<SourcingVerification> {
    const client = tx ?? this.db;

    return client.sourcingVerification.upsert({
      where: { candidateId },
      update: {},
      create: {
        candidateId,
        status: 'UNVERIFIED',
        factoryExists: false,
        moqConfirmed: false,
        priceReasonable: false,
        sampleAvailable: false,
        shippingFeasible: false,
        supplierResponsive: false,
      },
    });
  }

  /**
   * Find verification record by candidate ID.
   */
  async findByCandidateId(
    candidateId: string,
    tx?: TransactionClient,
  ): Promise<SourcingVerification | null> {
    const client = tx ?? this.db;
    return client.sourcingVerification.findUnique({
      where: { candidateId },
      include: {
        reviewer: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });
  }

  /**
   * Find verification record by candidate ID or throw.
   */
  async findByCandidateIdOrThrow(
    candidateId: string,
    tx?: TransactionClient,
  ): Promise<SourcingVerification> {
    const verification = await this.findByCandidateId(candidateId, tx);
    if (!verification) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Sourcing verification for candidate '${candidateId}' not found`,
        statusCode: 404,
      });
    }
    return verification;
  }

  /**
   * Update the verification record with a new status, checklist items, and notes.
   */
  async update(
    candidateId: string,
    data: {
      status: SourcingVerificationStatus;
      reviewerId: string;
      notes?: string;
      factoryExists?: boolean;
      moqConfirmed?: boolean;
      priceReasonable?: boolean;
      sampleAvailable?: boolean;
      shippingFeasible?: boolean;
      supplierResponsive?: boolean;
    },
    tx?: TransactionClient,
  ): Promise<SourcingVerification> {
    const client = tx ?? this.db;

    const existing = await client.sourcingVerification.findUnique({
      where: { candidateId },
    });

    if (!existing) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Sourcing verification for candidate '${candidateId}' not found`,
        statusCode: 404,
      });
    }

    const verifiedNow =
      data.status === 'VERIFIED' || data.status === 'REJECTED'
        ? new Date()
        : existing.verifiedAt;

    const updateData: Prisma.SourcingVerificationUncheckedUpdateInput = {
      status: data.status,
      reviewerId: data.reviewerId,
      verifiedAt: verifiedNow,
    };

    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.factoryExists !== undefined) updateData.factoryExists = data.factoryExists;
    if (data.moqConfirmed !== undefined) updateData.moqConfirmed = data.moqConfirmed;
    if (data.priceReasonable !== undefined) updateData.priceReasonable = data.priceReasonable;
    if (data.sampleAvailable !== undefined) updateData.sampleAvailable = data.sampleAvailable;
    if (data.shippingFeasible !== undefined) updateData.shippingFeasible = data.shippingFeasible;
    if (data.supplierResponsive !== undefined) updateData.supplierResponsive = data.supplierResponsive;

    return client.sourcingVerification.update({
      where: { candidateId },
      data: updateData,
      include: {
        reviewer: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });
  }

  /**
   * List all verifications with a given status, for monitoring.
   */
  async findByStatus(
    status: SourcingVerificationStatus,
    tx?: TransactionClient,
  ): Promise<SourcingVerification[]> {
    const client = tx ?? this.db;
    return client.sourcingVerification.findMany({
      where: { status },
      include: {
        candidate: {
          select: { id: true, name: true, factoryUnitCost: true, moq: true },
        },
        reviewer: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Delete the verification record for a candidate.
   * Returns the deleted record or null if none existed.
   * Must be called before deleting the parent ProductCandidate.
   */
  async deleteByCandidateId(
    candidateId: string,
    tx?: TransactionClient,
  ): Promise<SourcingVerification | null> {
    const client = tx ?? this.db;
    const existing = await client.sourcingVerification.findUnique({
      where: { candidateId },
    });
    if (!existing) return null;

    await client.sourcingVerification.delete({ where: { candidateId } });
    return existing;
  }

  /**
   * Delete all verification records for candidates in a research project.
   * Returns the count of deleted records.
   */
  async deleteByResearchProjectId(
    projectId: string,
    tx?: TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.db;
    const result = await client.sourcingVerification.deleteMany({
      where: {
        candidate: { researchProjectId: projectId },
      },
    });
    return result.count;
  }
}

export const sourcingVerificationRepository = new SourcingVerificationRepository();
