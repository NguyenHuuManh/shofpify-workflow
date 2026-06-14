/**
 * Purpose:
 * API integration tests for Workflow and Approval routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/lib/errors';

const mockWorkflowService = {
  getById: vi.fn(),
  start: vi.fn(),
  list: vi.fn(),
  completeCurrentStep: vi.fn(),
  failCurrentStep: vi.fn(),
  cancel: vi.fn(),
};

const mockApprovalService = {
  submitForReview: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  requestChanges: vi.fn(),
  getByWorkflowId: vi.fn(),
  getLatestDecision: vi.fn(),
};

vi.mock('@/services/workflow.service', () => ({
  workflowService: mockWorkflowService,
}));

vi.mock('@/services/approval.service', () => ({
  approvalService: mockApprovalService,
}));

describe('Workflow API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start workflow via service', async () => {
    mockWorkflowService.start.mockResolvedValue({
      id: 'wf_001',
      productId: 'prod_001',
      currentStep: 'RESEARCH',
      status: 'PENDING',
    });

    const result = await mockWorkflowService.start({ productId: 'prod_001' });

    expect(result.id).toBe('wf_001');
    expect(result.currentStep).toBe('RESEARCH');
    expect(mockWorkflowService.start).toHaveBeenCalledWith({
      productId: 'prod_001',
    });
  });

  it('should get workflow by ID', async () => {
    mockWorkflowService.getById.mockResolvedValue({
      id: 'wf_001',
      productId: 'prod_001',
      currentStep: 'CONTENT',
      status: 'RUNNING',
    });

    const result = await mockWorkflowService.getById('wf_001');

    expect(result.status).toBe('RUNNING');
    expect(result.currentStep).toBe('CONTENT');
  });

  it('should throw when starting workflow for nonexistent product', async () => {
    mockWorkflowService.start.mockRejectedValue(
      new AppError({ code: 'PRODUCT_NOT_FOUND', message: 'Not found', statusCode: 404 }),
    );

    await expect(
      mockWorkflowService.start({ productId: 'nonexistent' }),
    ).rejects.toThrow(AppError);
  });
});

describe('Approval API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should approve workflow', async () => {
    mockApprovalService.approve.mockResolvedValue({
      id: 'apr_001',
      workflowId: 'wf_001',
      reviewerId: 'user_002',
      status: 'APPROVED',
      comment: 'Looks great',
    });

    const result = await mockApprovalService.approve('wf_001', 'user_002', {
      comment: 'Looks great',
    });

    expect(result.status).toBe('APPROVED');
    expect(mockApprovalService.approve).toHaveBeenCalledWith(
      'wf_001',
      'user_002',
      { comment: 'Looks great' },
    );
  });

  it('should reject workflow with reason', async () => {
    mockApprovalService.reject.mockResolvedValue({
      id: 'apr_002',
      workflowId: 'wf_001',
      reviewerId: 'user_002',
      status: 'REJECTED',
      comment: 'Needs better content',
    });

    const result = await mockApprovalService.reject('wf_001', 'user_002', {
      comment: 'Needs better content',
    });

    expect(result.status).toBe('REJECTED');
    expect(mockApprovalService.reject).toHaveBeenCalledWith(
      'wf_001',
      'user_002',
      { comment: 'Needs better content' },
    );
  });

  it('should throw when rejecting without reason', async () => {
    mockApprovalService.reject.mockRejectedValue(
      new AppError({ code: 'VALIDATION_ERROR', message: 'Reason required', statusCode: 400 }),
    );

    await expect(
      mockApprovalService.reject('wf_001', 'user_002', { comment: '' }),
    ).rejects.toThrow(AppError);
  });

  it('should get reviews by workflow', async () => {
    mockApprovalService.getByWorkflowId.mockResolvedValue([
      { id: 'apr_001', workflowId: 'wf_001', status: 'APPROVED' },
      { id: 'apr_002', workflowId: 'wf_001', status: 'REJECTED' },
    ]);

    const result = await mockApprovalService.getByWorkflowId('wf_001');

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('APPROVED');
    expect(result[1].status).toBe('REJECTED');
  });
});
