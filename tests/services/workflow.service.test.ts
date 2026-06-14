/**
 * Purpose:
 * Unit tests for WorkflowService.
 * Tests workflow lifecycle with mocked repositories.
 *
 * Dependencies:
 * - vitest
 * - WorkflowService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowService } from '@/services/workflow.service';
import { AppError } from '@/lib/errors';
import type { Workflow, WorkflowStep, WorkflowStatus, WorkflowStepType } from '@prisma/client';

const mockWorkflow: Workflow = {
  id: 'wf_001',
  productId: 'prod_001',
  userId: 'user_001',
  currentStep: 'RESEARCH' as WorkflowStepType,
  status: 'PENDING' as WorkflowStatus,
  startedAt: new Date('2026-01-01'),
  completedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockStep: WorkflowStep = {
  id: 'step_001',
  workflowId: 'wf_001',
  step: 'RESEARCH' as WorkflowStepType,
  status: 'PENDING',
  startedAt: new Date('2026-01-01'),
  completedAt: null,
  errorMessage: null,
  metadata: null,
  createdAt: new Date('2026-01-01'),
};

describe('WorkflowService', () => {
  let service: WorkflowService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWorkflowRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockStepRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProductRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuditRepo: any;

  beforeEach(() => {
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

    mockStepRepo = {
      findById: vi.fn(),
      findByWorkflowId: vi.fn(),
      findCurrentStep: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      markRunning: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
      deleteByWorkflowId: vi.fn(),
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

    service = new WorkflowService(
      mockWorkflowRepo,
      mockStepRepo,
      mockProductRepo,
      mockAuditRepo,
    );
  });

  // ---------------------------------------------------------------------------
  // getById
  // ---------------------------------------------------------------------------

  describe('getById', () => {
    it('should return workflow with related data', async () => {
      mockWorkflowRepo.findByIdOrThrow.mockResolvedValue(mockWorkflow);

      const result = await service.getById('wf_001');

      expect(result).toEqual(mockWorkflow);
      expect(mockWorkflowRepo.findByIdOrThrow).toHaveBeenCalledWith('wf_001', {
        includeRelated: true,
      });
    });

    it('should throw when workflow not found', async () => {
      mockWorkflowRepo.findByIdOrThrow.mockRejectedValue(
        new AppError({ code: 'WORKFLOW_NOT_FOUND', message: 'Not found', statusCode: 404 }),
      );

      await expect(service.getById('nonexistent')).rejects.toThrow(AppError);
    });
  });

  // ---------------------------------------------------------------------------
  // start
  // ---------------------------------------------------------------------------

  describe('start', () => {
    it('should throw when product not found', async () => {
      mockProductRepo.findByIdOrThrow.mockRejectedValue(
        new AppError({ code: 'PRODUCT_NOT_FOUND', message: 'Not found', statusCode: 404 }),
      );

      await expect(
        service.start({ productId: 'nonexistent' }),
      ).rejects.toThrow(AppError);
    });

    it('should throw when active workflow already exists', async () => {
      mockProductRepo.findByIdOrThrow.mockResolvedValue({ id: 'prod_001', title: 'Test' });
      mockWorkflowRepo.findByProductId.mockResolvedValue({
        ...mockWorkflow,
        status: 'RUNNING',
      });

      await expect(
        service.start({ productId: 'prod_001' }),
      ).rejects.toThrow(AppError);
    });
  });

  // ---------------------------------------------------------------------------
  // completeCurrentStep
  // ---------------------------------------------------------------------------

  describe('completeCurrentStep', () => {
    it('should throw when no running step', async () => {
      mockWorkflowRepo.findByIdOrThrow.mockResolvedValue(mockWorkflow);
      mockStepRepo.findByWorkflowId.mockResolvedValue([
        { ...mockStep, status: 'COMPLETED' },
      ]);

      await expect(
        service.completeCurrentStep('wf_001'),
      ).rejects.toThrow(AppError);
    });
  });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------

  describe('list', () => {
    it('should return workflows with pagination', async () => {
      mockWorkflowRepo.findMany.mockResolvedValue([mockWorkflow]);
      mockWorkflowRepo.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, limit: 20 });

      expect(result.workflows).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply status filter', async () => {
      mockWorkflowRepo.findMany.mockResolvedValue([]);
      mockWorkflowRepo.count.mockResolvedValue(0);

      await service.list({ status: 'RUNNING', page: 1, limit: 10 });

      expect(mockWorkflowRepo.findMany).toHaveBeenCalledWith({
        status: 'RUNNING',
        currentStep: undefined,
        skip: 0,
        take: 10,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // cancel
  // ---------------------------------------------------------------------------

  describe('cancel', () => {
    it('should cancel workflow and audit', async () => {
      mockWorkflowRepo.updateStatus.mockResolvedValue({
        ...mockWorkflow,
        status: 'CANCELLED',
      });
      mockAuditRepo.create.mockResolvedValue({});

      const result = await service.cancel('wf_001', 'user_001');

      expect(result.status).toBe('CANCELLED');
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WORKFLOW_CANCELLED' }),
      );
    });
  });
});
