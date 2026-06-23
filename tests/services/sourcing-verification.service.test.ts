/**
 * Purpose:
 * Unit tests for SourcingVerificationService.
 *
 * Responsibilities:
 * - Verify verification initialization for candidates
 * - Verify human decisions (VERIFIED, REJECTED, NEEDS_MORE_INFO)
 * - Verify checklist item persistence
 * - Verify audit log and candidate metadata update
 *
 * Dependencies:
 * - SourcingVerificationService
 * - Vitest
 */

import { describe, expect, it, vi } from 'vitest';
import { SourcingVerificationService } from '@/services/sourcing-verification.service';
import type { SourcingVerificationRepository } from '@/repositories/sourcing-verification.repository';
import type { ProductCandidateRepository } from '@/repositories/product-candidate.repository';
import type { AuditLogRepository } from '@/repositories/audit-log.repository';

function mockCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cand_001',
    researchRunId: 'run_001',
    researchProjectId: 'project_001',
    productId: null,
    name: 'Portable Blender',
    positioning: 'Compact smoothie maker',
    targetMarket: 'US',
    sellingAngle: 'Blend anywhere',
    recommendedPrice: null,
    estimatedCOGS: null,
    estimatedShipping: null,
    factoryUnitCost: 12.5,
    moq: 100,
    landedCost: null,
    landedCostBreakdown: null,
    estimatedGrossProfit: null,
    grossMarginPercent: null,
    breakEvenRoas: null,
    demandScore: null,
    trendScore: null,
    competitionScore: null,
    marginScore: null,
    supplierScore: null,
    sourcingScore: null,
    factoryCostScore: null,
    logisticsScore: null,
    creativePotentialScore: null,
    riskScore: null,
    winningScore: null,
    confidence: 'medium',
    status: 'DISCOVERED',
    risks: [],
    metadata: {},
    createdAt: new Date('2026-06-01'),
    ...overrides,
  };
}

function makeVerificationRepo(
  overrides: Partial<SourcingVerificationRepository> = {},
): SourcingVerificationRepository {
  return {
    // Base repository defaults
    db: undefined as unknown as never,
    withTransaction: undefined,
    // Repository-specific methods
    create: vi.fn().mockResolvedValue(mockVerificationRecord()),
    findOrCreate: vi.fn().mockResolvedValue(mockVerificationRecord()),
    findByCandidateId: vi.fn().mockResolvedValue(null),
    findByCandidateIdOrThrow: vi.fn().mockResolvedValue(mockVerificationRecord()),
    update: vi.fn().mockResolvedValue(
      mockVerificationRecord({ status: 'VERIFIED', verifiedAt: new Date() }),
    ),
    findByStatus: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as SourcingVerificationRepository;
}

function makeCandidateRepo(
  overrides: Partial<ProductCandidateRepository> = {},
): ProductCandidateRepository {
  return {
    db: undefined as unknown as never,
    withTransaction: undefined,
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(mockCandidate()),
    findByIdOrThrow: vi.fn().mockResolvedValue(mockCandidate()),
    updateMetadata: vi.fn().mockResolvedValue(mockCandidate()),
    findByResearchRunId: vi.fn(),
    findByResearchProjectId: vi.fn(),
    updateStatus: vi.fn(),
    updateSourcingAnalysis: vi.fn(),
    ...overrides,
  } as unknown as ProductCandidateRepository;
}

function makeAuditRepo(
  overrides: Partial<AuditLogRepository> = {},
): AuditLogRepository {
  return {
    db: undefined as unknown as never,
    withTransaction: undefined,
    create: vi.fn().mockResolvedValue({ id: 'audit_001' }),
    ...overrides,
  } as unknown as AuditLogRepository;
}

function mockVerificationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ver_001',
    candidateId: 'cand_001',
    reviewerId: null,
    status: 'UNVERIFIED',
    notes: null,
    verifiedAt: null,
    createdAt: new Date('2026-06-23'),
    updatedAt: new Date('2026-06-23'),
    factoryExists: false,
    moqConfirmed: false,
    priceReasonable: false,
    sampleAvailable: false,
    shippingFeasible: false,
    supplierResponsive: false,
    ...overrides,
  };
}

describe('SourcingVerificationService', () => {
  // ---------------------------------------------------------------------------
  // ensureVerificationExists
  // ---------------------------------------------------------------------------

  describe('ensureVerificationExists', () => {
    it('creates a verification record when none exists', async () => {
      const candidateRepo = makeCandidateRepo();
      const verificationRepo = makeVerificationRepo({
        findOrCreate: vi.fn().mockResolvedValue(
          mockVerificationRecord({ status: 'UNVERIFIED' }),
        ),
      });
      const auditRepo = makeAuditRepo();

      const service = new SourcingVerificationService(
        verificationRepo,
        candidateRepo,
        auditRepo,
      );

      const result = await service.ensureVerificationExists('cand_001');

      expect(result.verification.status).toBe('UNVERIFIED');
      expect(result.candidate.name).toBe('Portable Blender');
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'SourcingVerification',
          action: 'VERIFICATION_INITIALIZED',
        }),
      );
    });

    it('returns existing verification without creating duplicate', async () => {
      const candidateRepo = makeCandidateRepo();
      const verificationRepo = makeVerificationRepo({
        findOrCreate: vi.fn().mockResolvedValue(
          mockVerificationRecord({ status: 'VERIFIED', verifiedAt: new Date() }),
        ),
      });
      const auditRepo = makeAuditRepo();

      const service = new SourcingVerificationService(
        verificationRepo,
        candidateRepo,
        auditRepo,
      );

      const result = await service.ensureVerificationExists('cand_001');

      expect(result.verification.status).toBe('VERIFIED');
      expect(verificationRepo.findOrCreate).toHaveBeenCalledWith('cand_001');
    });
  });

  // ---------------------------------------------------------------------------
  // getVerification
  // ---------------------------------------------------------------------------

  describe('getVerification', () => {
    it('returns null when no verification exists', async () => {
      const candidateRepo = makeCandidateRepo();
      const verificationRepo = makeVerificationRepo({
        findByCandidateId: vi.fn().mockResolvedValue(null),
      });
      const auditRepo = makeAuditRepo();

      const service = new SourcingVerificationService(
        verificationRepo,
        candidateRepo,
        auditRepo,
      );

      const result = await service.getVerification('cand_001');
      expect(result).toBeNull();
    });

    it('returns the verification record when it exists', async () => {
      const record = mockVerificationRecord({ status: 'PENDING_VERIFICATION' });
      const candidateRepo = makeCandidateRepo();
      const verificationRepo = makeVerificationRepo({
        findByCandidateId: vi.fn().mockResolvedValue(record),
      });
      const auditRepo = makeAuditRepo();

      const service = new SourcingVerificationService(
        verificationRepo,
        candidateRepo,
        auditRepo,
      );

      const result = await service.getVerification('cand_001');
      expect(result).not.toBeNull();
      expect(result?.status).toBe('PENDING_VERIFICATION');
    });
  });

  // ---------------------------------------------------------------------------
  // applyDecision — VERIFIED
  // ---------------------------------------------------------------------------

  describe('applyDecision — VERIFIED', () => {
    it('persists VERIFIED status with checklist items', async () => {
      const candidateRepo = makeCandidateRepo();
      const verificationRepo = makeVerificationRepo({
        findOrCreate: vi.fn().mockResolvedValue(mockVerificationRecord()),
        update: vi.fn().mockResolvedValue(
          mockVerificationRecord({
            status: 'VERIFIED',
            verifiedAt: new Date('2026-06-23T10:00:00Z'),
            factoryExists: true,
            moqConfirmed: true,
            priceReasonable: true,
            sampleAvailable: false,
            shippingFeasible: true,
            supplierResponsive: false,
            notes: 'Looks good after checking store and reviews',
            reviewerId: 'user_001',
          }),
        ),
      });
      const auditRepo = makeAuditRepo();

      const service = new SourcingVerificationService(
        verificationRepo,
        candidateRepo,
        auditRepo,
      );

      const result = await service.applyDecision('cand_001', {
        status: 'VERIFIED',
        reviewerId: 'user_001',
        notes: 'Looks good after checking store and reviews',
        factoryExists: true,
        moqConfirmed: true,
        priceReasonable: true,
        sampleAvailable: false,
        shippingFeasible: true,
        supplierResponsive: false,
      });

      expect(result.verification.status).toBe('VERIFIED');
      expect(result.verification.factoryExists).toBe(true);
      expect(result.verification.moqConfirmed).toBe(true);
      expect(result.verification.sampleAvailable).toBe(false);
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOURCING_VERIFIED',
        }),
      );
      expect(candidateRepo.updateMetadata).toHaveBeenCalledWith(
        'cand_001',
        expect.objectContaining({
          sourcingVerification: expect.objectContaining({
            status: 'VERIFIED',
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // applyDecision — REJECTED
  // ---------------------------------------------------------------------------

  describe('applyDecision — REJECTED', () => {
    it('persists REJECTED status with rejection notes', async () => {
      const candidateRepo = makeCandidateRepo();
      const verificationRepo = makeVerificationRepo({
        findOrCreate: vi.fn().mockResolvedValue(mockVerificationRecord()),
        update: vi.fn().mockResolvedValue(
          mockVerificationRecord({
            status: 'REJECTED',
            verifiedAt: new Date('2026-06-23T11:00:00Z'),
            factoryExists: false,
            moqConfirmed: false,
            priceReasonable: false,
            sampleAvailable: false,
            shippingFeasible: false,
            supplierResponsive: false,
            notes: 'Supplier cannot be reached, listing appears stale',
            reviewerId: 'user_002',
          }),
        ),
      });
      const auditRepo = makeAuditRepo();

      const service = new SourcingVerificationService(
        verificationRepo,
        candidateRepo,
        auditRepo,
      );

      const result = await service.applyDecision('cand_001', {
        status: 'REJECTED',
        reviewerId: 'user_002',
        notes: 'Supplier cannot be reached, listing appears stale',
      });

      expect(result.verification.status).toBe('REJECTED');
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOURCING_REJECTED',
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // applyDecision — NEEDS_MORE_INFO
  // ---------------------------------------------------------------------------

  describe('applyDecision — NEEDS_MORE_INFO', () => {
    it('persists NEEDS_MORE_INFO without finalizing verification', async () => {
      const candidateRepo = makeCandidateRepo();
      const verificationRepo = makeVerificationRepo({
        findOrCreate: vi.fn().mockResolvedValue(mockVerificationRecord()),
        update: vi.fn().mockResolvedValue(
          mockVerificationRecord({
            status: 'NEEDS_MORE_INFO',
            verifiedAt: null,
            notes: 'Need to contact supplier for MOQ confirmation',
            reviewerId: 'user_003',
          }),
        ),
      });
      const auditRepo = makeAuditRepo();

      const service = new SourcingVerificationService(
        verificationRepo,
        candidateRepo,
        auditRepo,
      );

      const result = await service.applyDecision('cand_001', {
        status: 'NEEDS_MORE_INFO',
        reviewerId: 'user_003',
        notes: 'Need to contact supplier for MOQ confirmation',
      });

      expect(result.verification.status).toBe('NEEDS_MORE_INFO');
      expect(result.verification.verifiedAt).toBeNull();
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOURCING_NEEDS_MORE_INFO',
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // applyDecision — PENDING_VERIFICATION
  // ---------------------------------------------------------------------------

  describe('applyDecision — PENDING_VERIFICATION', () => {
    it('marks as pending without final decision', async () => {
      const candidateRepo = makeCandidateRepo();
      const verificationRepo = makeVerificationRepo({
        findOrCreate: vi.fn().mockResolvedValue(mockVerificationRecord()),
        update: vi.fn().mockResolvedValue(
          mockVerificationRecord({
            status: 'PENDING_VERIFICATION',
            verifiedAt: null,
            reviewerId: 'user_004',
          }),
        ),
      });
      const auditRepo = makeAuditRepo();

      const service = new SourcingVerificationService(
        verificationRepo,
        candidateRepo,
        auditRepo,
      );

      const result = await service.applyDecision('cand_001', {
        status: 'PENDING_VERIFICATION',
        reviewerId: 'user_004',
      });

      expect(result.verification.status).toBe('PENDING_VERIFICATION');
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOURCING_PENDING_VERIFICATION',
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // list methods
  // ---------------------------------------------------------------------------

  describe('getPendingVerifications', () => {
    it('returns candidates with PENDING_VERIFICATION status', async () => {
      const candidateRepo = makeCandidateRepo();
      const verificationRepo = makeVerificationRepo({
        findByStatus: vi.fn().mockResolvedValue([
          mockVerificationRecord({ status: 'PENDING_VERIFICATION', candidateId: 'cand_002' }),
          mockVerificationRecord({ status: 'PENDING_VERIFICATION', candidateId: 'cand_003' }),
        ]),
      });
      const auditRepo = makeAuditRepo();

      const service = new SourcingVerificationService(
        verificationRepo,
        candidateRepo,
        auditRepo,
      );

      const results = await service.getPendingVerifications();
      expect(results).toHaveLength(2);
      expect(results[0]?.status).toBe('PENDING_VERIFICATION');
    });
  });

  describe('getVerifiedCandidates', () => {
    it('returns candidates with VERIFIED status', async () => {
      const candidateRepo = makeCandidateRepo();
      const verificationRepo = makeVerificationRepo({
        findByStatus: vi.fn().mockResolvedValue([
          mockVerificationRecord({
            status: 'VERIFIED',
            candidateId: 'cand_005',
            verifiedAt: new Date(),
          }),
        ]),
      });
      const auditRepo = makeAuditRepo();

      const service = new SourcingVerificationService(
        verificationRepo,
        candidateRepo,
        auditRepo,
      );

      const results = await service.getVerifiedCandidates();
      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('VERIFIED');
    });
  });
});
