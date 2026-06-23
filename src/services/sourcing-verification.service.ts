/**
 * Purpose:
 * Sourcing verification workflow service for human supplier validation.
 *
 * Responsibilities:
 * - Initialize verification records when a candidate gets sourcing data
 * - Accept human verification decisions (VERIFIED, REJECTED, NEEDS_MORE_INFO)
 * - PERSIST verification checklist and audit log
 * - Never call external sourcing providers, 1688, DajiSaaS, Apify, or AI directly
 *
 * Dependencies:
 * - SourcingVerificationRepository
 * - ProductCandidateRepository
 * - AuditLogRepository
 */

import { sourcingVerificationRepository } from '@/repositories/sourcing-verification.repository';
import { productCandidateRepository } from '@/repositories/product-candidate.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { logger } from '@/lib/logger';
import { validate } from '@/lib/validate';
import { sourcingVerificationUpdateSchema } from '@/schemas/research.schema';
import type { SourcingVerificationRepository } from '@/repositories/sourcing-verification.repository';
import type { ProductCandidateRepository } from '@/repositories/product-candidate.repository';
import type { AuditLogRepository } from '@/repositories/audit-log.repository';
import type {
  SourcingVerificationUpdateInput,
  SourcingVerificationUpdate,
} from '@/schemas/research.schema';
import type { SourcingVerification, ProductCandidate } from '@prisma/client';

export interface VerificationInitResult {
  verification: SourcingVerification;
  candidate: ProductCandidate;
}

export interface VerificationDecisionResult {
  verification: SourcingVerification;
  candidate: ProductCandidate;
}

export class SourcingVerificationService {
  constructor(
    private readonly verificationRepo: SourcingVerificationRepository = sourcingVerificationRepository,
    private readonly candidateRepo: ProductCandidateRepository = productCandidateRepository,
    private readonly auditRepo: AuditLogRepository = auditLogRepository,
  ) {}

  /**
   * Initialize a verification record for a candidate that has sourcing evidence.
   * Safe to call multiple times — uses upsert (findOrCreate).
   */
  async ensureVerificationExists(candidateId: string): Promise<VerificationInitResult> {
    const candidate = await this.candidateRepo.findByIdOrThrow(candidateId);
    const verification = await this.verificationRepo.findOrCreate(candidateId);

    await this.auditRepo.create({
      entityType: 'SourcingVerification',
      entityId: verification.id,
      action: 'VERIFICATION_INITIALIZED',
      actorId: undefined,
      metadata: {
        candidateId: candidate.id,
        candidateName: candidate.name,
        hasSourcing: Boolean(candidate.factoryUnitCost || candidate.moq),
      },
    });

    logger.info(
      { candidateId, verificationId: verification.id, status: verification.status },
      'Sourcing verification record ensured for candidate',
    );

    return { verification, candidate };
  }

  /**
   * Get the current verification status for a candidate.
   */
  async getVerification(candidateId: string): Promise<SourcingVerification | null> {
    return this.verificationRepo.findByCandidateId(candidateId);
  }

  /**
   * Apply a human verification decision to a candidate's sourcing evidence.
   *
   * Status changes:
   * - VERIFIED     → supplier sourcing data confirmed by human review
   * - REJECTED     → supplier sourcing data rejected / not credible
   * - NEEDS_MORE_INFO → supplier needs follow-up before decision
   * - PENDING_VERIFICATION → mark as needing review (without final decision)
   */
  async applyDecision(
    candidateId: string,
    input: SourcingVerificationUpdateInput,
  ): Promise<VerificationDecisionResult> {
    const parsed = validate(sourcingVerificationUpdateSchema, input);
    const candidate = await this.candidateRepo.findByIdOrThrow(candidateId);

    // Ensure verification record exists
    await this.verificationRepo.findOrCreate(candidateId);

    const verification = await this.verificationRepo.update(candidateId, {
      status: parsed.status,
      reviewerId: parsed.reviewerId,
      notes: parsed.notes,
      factoryExists: parsed.factoryExists,
      moqConfirmed: parsed.moqConfirmed,
      priceReasonable: parsed.priceReasonable,
      sampleAvailable: parsed.sampleAvailable,
      shippingFeasible: parsed.shippingFeasible,
      supplierResponsive: parsed.supplierResponsive,
    });

    // Update candidate metadata with verification status
    const currentMetadata = (candidate.metadata as Record<string, unknown>) ?? {};
    const enrichedMetadata = {
      ...currentMetadata,
      sourcingVerification: {
        status: verification.status,
        verifiedAt: verification.verifiedAt?.toISOString() ?? null,
      },
    };
    await this.candidateRepo.updateMetadata(candidateId, enrichedMetadata);

    await this.auditRepo.create({
      entityType: 'SourcingVerification',
      entityId: verification.id,
      action: this.auditActionForStatus(parsed.status),
      actorId: parsed.reviewerId,
      metadata: {
        candidateId: candidate.id,
        candidateName: candidate.name,
        status: parsed.status,
        checklist: this.summarizeChecklist(parsed),
        notes: parsed.notes ?? null,
      },
    });

    logger.info(
      {
        candidateId,
        verificationId: verification.id,
        status: verification.status,
        reviewerId: parsed.reviewerId,
      },
      `Sourcing verification decision applied: ${parsed.status}`,
    );

    return { verification, candidate };
  }

  /**
   * List all candidates pending verification.
   */
  async getPendingVerifications(): Promise<SourcingVerification[]> {
    return this.verificationRepo.findByStatus('PENDING_VERIFICATION');
  }

  /**
   * List all verified candidates.
   */
  async getVerifiedCandidates(): Promise<SourcingVerification[]> {
    return this.verificationRepo.findByStatus('VERIFIED');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private auditActionForStatus(status: SourcingVerificationUpdate['status']): string {
    switch (status) {
      case 'VERIFIED':
        return 'SOURCING_VERIFIED';
      case 'REJECTED':
        return 'SOURCING_REJECTED';
      case 'NEEDS_MORE_INFO':
        return 'SOURCING_NEEDS_MORE_INFO';
      case 'PENDING_VERIFICATION':
        return 'SOURCING_PENDING_VERIFICATION';
      default:
        return 'SOURCING_VERIFICATION_UPDATED';
    }
  }

  private summarizeChecklist(data: SourcingVerificationUpdate): Record<string, boolean | undefined> {
    return {
      factoryExists: data.factoryExists,
      moqConfirmed: data.moqConfirmed,
      priceReasonable: data.priceReasonable,
      sampleAvailable: data.sampleAvailable,
      shippingFeasible: data.shippingFeasible,
      supplierResponsive: data.supplierResponsive,
    };
  }
}

export const sourcingVerificationService = new SourcingVerificationService();
