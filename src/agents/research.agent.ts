/**
 * Purpose:
 * ResearchAgent — orchestrates the Research Product Intelligence Module.
 *
 * Architecture: Agent → ResearchService → Provider interfaces / Repositories.
 *
 * Responsibilities:
 * - Trigger source-backed candidate discovery
 * - Return selected run/candidate context to workflow state
 *
 * Dependencies:
 * - AIProvider (interface, via BaseAgent)
 * - ResearchService
 * - WorkflowContext types
 */

import { BaseAgent } from './base-agent';
import { researchService, type ResearchService } from '@/services/research.service';
import type { WorkflowContext } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';
import { logger } from '@/lib/logger';

export class ResearchAgent extends BaseAgent {
  readonly name = 'ResearchAgent';

  constructor(
    aiProvider?: AIProvider,
    private readonly service: ResearchService = researchService,
  ) {
    super(aiProvider);
  }

  async execute(context: WorkflowContext): Promise<WorkflowContext> {
    logger.info({ workflowId: context.workflowId, product: context.productIdea }, 'ResearchAgent started');

    const result = await this.service.run(
      {
        workflowId: context.workflowId,
        productId: context.productId,
        productIdea: context.productIdea,
      },
      this.ai,
    );

    logger.info({ workflowId: context.workflowId }, 'ResearchAgent completed');

    return {
      ...context,
      researchRunId: result.researchRun.id,
      productCandidates: result.candidates,
      research: {
        targetAudience: {
          source: 'Research Product Intelligence Module',
        },
        competitors: {},
        painPoints: {},
        usp: {
          recommendation: result.recommendation,
        },
        marketSummary: result.summary,
      },
    };
  }
}
