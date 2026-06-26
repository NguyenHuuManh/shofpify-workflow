/**
 * Purpose:
 * Unit tests for DiscoveryJobService.
 */

import { describe, expect, it, vi } from 'vitest';
import { DiscoveryJobService } from '@/services/discovery-job.service';
import { QueryIntelligenceService } from '@/services/query-intelligence.service';
import { BaseRepository } from '@/repositories/base.repository';
import type { ResearchProvider } from '@/types/research.types';

describe('DiscoveryJobService', () => {
  it('should collect provider-backed keywords and run discovery for each', async () => {
    vi.spyOn(BaseRepository, 'transaction').mockImplementation(async (fn) =>
      fn(undefined as never),
    );

    const input = {
      targetMarket: 'US',
      targetMarginPercent: 40,
      riskTolerance: 'medium' as const,
      excludedCategories: ['fragile'],
      maxQueries: 2,
      sourcing: {
        targetSource: '1688' as const,
        targetCurrency: 'USD',
        maxMoq: 500,
        landedCostAssumptions: {
          agentFeePercent: 8,
          internationalFreightPerUnit: 8,
        },
      },
    };
    const project = {
      id: 'project_001',
      query: 'Autonomous discovery for US winning products',
      status: 'ACTIVE',
      selectedCandidateId: null,
      promotedProductId: null,
      summary: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };
    const job = {
      id: 'job_001',
      researchProjectId: project.id,
      status: 'PENDING',
      input,
      queryPlan: null,
      result: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };
    const completedJob = {
      ...job,
      status: 'COMPLETED',
      completedAt: new Date('2026-01-01'),
    };
    const candidate = {
      id: 'candidate_001',
      researchRunId: 'run_001',
      name: 'Pet Travel Water Bottle',
      winningScore: 82,
    };
    const jobRepo = {
      create: vi.fn().mockResolvedValue(job),
      findByIdOrThrow: vi.fn().mockResolvedValue(job),
      findMany: vi.fn(),
      markRunning: vi.fn().mockResolvedValue({ ...job, status: 'RUNNING' }),
      markCompleted: vi.fn().mockResolvedValue(completedJob),
      markFailed: vi.fn(),
    };
    const projectRepo = {
      create: vi.fn().mockResolvedValue(project),
      findByIdOrThrow: vi.fn().mockResolvedValue(project),
      updateSummary: vi.fn().mockResolvedValue({ ...project, summary: 'done' }),
    };
    const candidateRepo = {
      findByResearchProjectId: vi.fn().mockResolvedValue([candidate]),
    };
    const auditRepo = {
      create: vi.fn().mockResolvedValue({ id: 'audit_001' }),
    };
    const researchSvc = {
      run: vi.fn().mockResolvedValue({ sources: [{ id: 'source_001' }] }),
    };
    // Provider-backed category/keyword root discovery source
    const keywordProvider: ResearchProvider = {
      name: 'DataForSeoLabsDiscoveryTestProvider',
      providerType: 'keyword',
      discoveryRootProvider: true,
      collect: vi.fn(async () => [
        {
          type: 'KEYWORD' as const,
          provider: 'DataForSEO Labs Top Searches',
          externalId: 'smart home gadget organizer',
          title: 'smart home gadget organizer keyword signal',
          extractedSignal: 'smart home gadget organizer, volume 12000, CPC 1.8',
          rawData: {
            keyword: 'smart home gadget organizer',
            categories: ['Home & Garden'],
            metrics: { searchVolume: 12000, cpc: 1.8 },
          },
          confidence: 0.74,
          capturedAt: new Date(),
        },
        {
          type: 'KEYWORD' as const,
          provider: 'DataForSEO Labs Top Searches',
          externalId: 'pet travel water bottle',
          title: 'pet travel water bottle keyword signal',
          extractedSignal: 'pet travel water bottle, volume 9000, CPC 1.4',
          rawData: {
            keyword: 'pet travel water bottle',
            categories: ['Animals & Pet Supplies'],
            metrics: { searchVolume: 9000, cpc: 1.4 },
          },
          confidence: 0.74,
          capturedAt: new Date(),
        },
      ]),
    };

    const service = new DiscoveryJobService(
      jobRepo as never,
      projectRepo as never,
      candidateRepo as never,
      auditRepo as never,
      researchSvc as never,
      new QueryIntelligenceService(),
      [keywordProvider],
    );

    const started = await service.start(input);
    const result = await service.runJob(started.discoveryJob.id);

    expect(started.discoveryJob.id).toBe('job_001');
    // No seed query -> uses provider-backed root discovery, not hardcoded category seeds.
    expect(researchSvc.run).toHaveBeenCalledTimes(2);
    expect(researchSvc.run.mock.calls.map((call) => call[0].productIdea)).toEqual([
      'smart home gadget organizer',
      'pet travel water bottle',
    ]);
    expect(jobRepo.markCompleted).toHaveBeenCalledWith(
      'job_001',
      expect.objectContaining({
        queryCount: 2,
        runCount: 2,
        candidateCount: 1,
        sourceCount: 2,
      }),
    );
    expect(result.result.topCandidates.at(0)?.id).toBe('candidate_001');
  });

  it('should fail without seed query when providers return no keyword evidence', async () => {
    vi.spyOn(BaseRepository, 'transaction').mockImplementation(async (fn) =>
      fn(undefined as never),
    );

    const input = {
      targetMarket: 'US',
      targetMarginPercent: 40,
      riskTolerance: 'medium' as const,
      excludedCategories: [],
      maxQueries: 2,
      sourcing: {
        targetSource: '1688' as const,
        targetCurrency: 'USD',
        landedCostAssumptions: {},
      },
    };
    const project = {
      id: 'project_003',
      query: 'Autonomous discovery for US winning products',
      status: 'ACTIVE',
      selectedCandidateId: null,
      promotedProductId: null,
      summary: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };
    const job = {
      id: 'job_003',
      researchProjectId: project.id,
      status: 'PENDING',
      input,
      queryPlan: null,
      result: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };
    const jobRepo = {
      create: vi.fn().mockResolvedValue(job),
      findByIdOrThrow: vi.fn().mockResolvedValue(job),
      markRunning: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn().mockResolvedValue({ ...job, status: 'FAILED' }),
    };
    const researchSvc = {
      run: vi.fn().mockResolvedValue({ sources: [] }),
    };
    const emptyProvider: ResearchProvider = {
      name: 'EmptyProvider',
      providerType: 'keyword',
      collect: vi.fn().mockResolvedValue([]),
    };

    const service = new DiscoveryJobService(
      jobRepo as never,
      {
        create: vi.fn().mockResolvedValue(project),
        findByIdOrThrow: vi.fn().mockResolvedValue(project),
        updateSummary: vi.fn().mockResolvedValue(project),
      } as never,
      { findByResearchProjectId: vi.fn().mockResolvedValue([]) } as never,
      { create: vi.fn().mockResolvedValue({ id: 'audit_003' }) } as never,
      researchSvc as never,
      new QueryIntelligenceService(),
      [emptyProvider],
    );

    await service.start(input);
    await expect(service.runJob('job_003')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 422,
    });

    expect(researchSvc.run).not.toHaveBeenCalled();
    expect(jobRepo.markRunning).not.toHaveBeenCalled();
    expect(jobRepo.markCompleted).not.toHaveBeenCalled();
    expect(jobRepo.markFailed).toHaveBeenCalledWith(
      'job_003',
      'No provider-backed discovery categories or keywords were found. Configure DataForSEO Labs or adjust discovery constraints.',
    );
  });

  it('should use seed query only when providers return no keyword evidence', async () => {
    vi.spyOn(BaseRepository, 'transaction').mockImplementation(async (fn) =>
      fn(undefined as never),
    );
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('DEEPSEEK_API_KEY', '');

    const input = {
      seedQuery: 'home organization',
      targetMarket: 'US',
      targetMarginPercent: 40,
      riskTolerance: 'medium' as const,
      excludedCategories: [],
      maxQueries: 2,
      sourcing: {
        targetSource: '1688' as const,
        targetCurrency: 'USD',
        landedCostAssumptions: {},
      },
    };
    const project = {
      id: 'project_002',
      query: 'home organization',
      status: 'ACTIVE',
      selectedCandidateId: null,
      promotedProductId: null,
      summary: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };
    const job = {
      id: 'job_002',
      researchProjectId: project.id,
      status: 'PENDING',
      input,
      queryPlan: null,
      result: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };
    const jobRepo = {
      create: vi.fn().mockResolvedValue(job),
      findByIdOrThrow: vi.fn().mockResolvedValue(job),
      markRunning: vi.fn().mockResolvedValue({ ...job, status: 'RUNNING' }),
      markCompleted: vi.fn().mockResolvedValue({ ...job, status: 'COMPLETED' }),
      markFailed: vi.fn(),
    };
    const projectRepo = {
      create: vi.fn().mockResolvedValue(project),
      findByIdOrThrow: vi.fn().mockResolvedValue(project),
      updateSummary: vi.fn().mockResolvedValue(project),
    };
    const researchSvc = {
      run: vi.fn().mockResolvedValue({ sources: [] }),
    };
    // Empty provider returns no evidence
    const emptyProvider: ResearchProvider = {
      name: 'EmptyProvider',
      providerType: 'keyword',
      collect: vi.fn().mockResolvedValue([]),
    };

    const service = new DiscoveryJobService(
      jobRepo as never,
      projectRepo as never,
      { findByResearchProjectId: vi.fn().mockResolvedValue([]) } as never,
      { create: vi.fn().mockResolvedValue({ id: 'audit_002' }) } as never,
      researchSvc as never,
      new QueryIntelligenceService(),
      [emptyProvider],
    );

    await service.start(input);
    await service.runJob('job_002');

    // Should run only 1 query (seed query only, no derived keywords)
    expect(researchSvc.run).toHaveBeenCalledTimes(1);
    expect(researchSvc.run).toHaveBeenCalledWith(
      expect.objectContaining({ productIdea: 'home organization' }),
    );
    expect(jobRepo.markCompleted).toHaveBeenCalledWith(
      'job_002',
      expect.objectContaining({ candidateCount: 0 }),
    );
  });
});
