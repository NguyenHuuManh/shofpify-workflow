/**
 * Purpose:
 * Unit tests for ApprovalService.
 * Tests the human review workflow with mocked repositories.
 *
 * Dependencies:
 * - vitest
 * - ApprovalService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalService } from '@/services/approval.service';
import { AppError } from '@/lib/errors';
import type { Approval, ApprovalStatus, Workflow, WorkflowStepType, WorkflowStatus } from '@prisma/client';

const mockWorkflow: Workflow = {
  id: 'wf_001',
  productId: 'prod_001',
  userId: 'user_001',
  currentStep: 'REVIEW' as WorkflowStepType,
  status: 'RUNNING' as WorkflowStatus,
  startedAt: new Date('2026-01-01'),
  completedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockApproval: Approval = {
  id: 'apr_001',
  workflowId: 'wf_001',
  reviewerId: 'user_002',
  status: 'APPROVED' as ApprovalStatus,
  comment: 'Looks good',
  createdAt: new Date('2026-01-01'),
};

describe('ApprovalService', () => {
  let service: ApprovalService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockApprovalRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWorkflowRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProductRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuditRepo: any;

  beforeEach(() => {
    mockApprovalRepo = {
      findById: vi.fn(),
      findByWorkflowId: vi.fn(),
      findLatestByWorkflowId: vi.fn(),
      create: vi.fn(),
      deleteByWorkflowId: vi.fn(),
    };

    mockWorkflowRepo = {
      findByIdOrThrow: vi.fn(),
      findById: vi.fn(),
      findByProductId: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updateCurrentStep: vi.fn(),
      delete: vi.fn(),
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

    service = new ApprovalService(
      mockApprovalRepo,
      mockWorkflowRepo,
      mockProductRepo,
      mockAuditRepo,
    );
  });

  // ---------------------------------------------------------------------------
  // submitForReview
  // ---------------------------------------------------------------------------

  describe('submitForReview', () => {
    it('should submit workflow for review', async () => {
      mockWorkflowRepo.findByIdOrThrow.mockResolvedValue(mockWorkflow);
      mockProductRepo.updateStatus.mockResolvedValue({});
      mockApprovalRepo.create.mockResolvedValue(mockApproval);
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.submitForReview({
        workflowId: 'wf_001',
        reviewerId: 'user_002',
      });

      expect(result).toEqual(mockApproval);
      expect(mockProductRepo.updateStatus).toHaveBeenCalledWith(
        'prod_001',
        'PENDING_REVIEW',
      );
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WORKFLOW_SUBMITTED_FOR_REVIEW' }),
      );
    });

    it('should throw when workflow is not at REVIEW step', async () => {
      mockWorkflowRepo.findByIdOrThrow.mockResolvedValue({
        ...mockWorkflow,
        currentStep: 'RESEARCH',
      });

      await expect(
        service.submitForReview({ workflowId: 'wf_001', reviewerId: 'user_002' }),
      ).rejects.toThrow(AppError);
    });

    it('should throw when workflow is not RUNNING', async () => {
      mockWorkflowRepo.findByIdOrThrow.mockResolvedValue({
        ...mockWorkflow,
        status: 'COMPLETED' as WorkflowStatus,
      });

      await expect(
        service.submitForReview({ workflowId: 'wf_001', reviewerId: 'user_002' }),
      ).rejects.toThrow(AppError);
    });
  });

  // ---------------------------------------------------------------------------
  // approve
  // ---------------------------------------------------------------------------

  describe('approve', () => {
    it('should approve workflow and set product to APPROVED', async () => {
      mockWorkflowRepo.findByIdOrThrow.mockResolvedValue(mockWorkflow);
      mockApprovalRepo.create.mockResolvedValue(mockApproval);
      mockProductRepo.updateStatus.mockResolvedValue({});
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.approve('wf_001', 'user_002', {
        comment: 'Looks great!',
      });

      expect(result.status).toBe('APPROVED');
      expect(mockProductRepo.updateStatus).toHaveBeenCalledWith(
        'prod_001',
        'APPROVED',
      );
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REVIEW_APPROVED' }),
      );
    });

    it('should throw when workflow is not RUNNING', async () => {
      mockWorkflowRepo.findByIdOrThrow.mockResolvedValue({
        ...mockWorkflow,
        status: 'COMPLETED',
      } as Workflow);

      await expect(
        service.approve('wf_001', 'user_002'),
      ).rejects.toThrow(AppError);
    });
  });

  // ---------------------------------------------------------------------------
  // reject
  // ---------------------------------------------------------------------------

  describe('reject', () => {
    it('should reject workflow and return product to DRAFT', async () => {
      mockWorkflowRepo.findByIdOrThrow.mockResolvedValue(mockWorkflow);
      mockApprovalRepo.create.mockResolvedValue({
        ...mockApproval,
        status: 'REJECTED' as ApprovalStatus,
        comment: 'Needs better title',
      });
      mockProductRepo.updateStatus.mockResolvedValue({});
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.reject('wf_001', 'user_002', {
        comment: 'Needs better title',
      });

      expect(result.status).toBe('REJECTED');
      expect(mockProductRepo.updateStatus).toHaveBeenCalledWith('prod_001', 'DRAFT');
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REVIEW_REJECTED' }),
      );
    });

    it('should throw when rejection comment is empty', async () => {
      await expect(
        service.reject('wf_001', 'user_002', { comment: '' }),
      ).rejects.toThrow(AppError);
    });
  });

  // ---------------------------------------------------------------------------
  // requestChanges
  // ---------------------------------------------------------------------------

  describe('requestChanges', () => {
    it('should request changes with comment', async () => {
      mockWorkflowRepo.findByIdOrThrow.mockResolvedValue(mockWorkflow);
      mockApprovalRepo.create.mockResolvedValue({
        ...mockApproval,
        status: 'CHANGES_REQUESTED' as ApprovalStatus,
      });
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.requestChanges('wf_001', 'user_002', {
        comment: 'Please expand the description',
      });

      expect(result.status).toBe('CHANGES_REQUESTED');
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REVIEW_CHANGES_REQUESTED' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getByWorkflowId
  // ---------------------------------------------------------------------------

  describe('getByWorkflowId', () => {
    it('should return approvals for workflow', async () => {
      mockApprovalRepo.findByWorkflowId.mockResolvedValue([mockApproval]);

      const result = await service.getByWorkflowId('wf_001');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockApproval);
    });
  });
});
