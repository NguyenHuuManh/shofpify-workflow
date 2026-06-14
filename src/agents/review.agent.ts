/**
 * Purpose:
 * ReviewAgent — validates all AI-generated content before human review.
 * Checks for completeness, quality, and policy compliance.
 *
 * Architecture: Agent → AIProvider (interface), Service Layer
 *
 * Responsibilities:
 * - Review all generated content for quality
 * - Check for missing or incomplete sections
 * - Flag potential issues for human reviewer
 * - Generate a review summary with scores
 *
 * Dependencies:
 * - AIProvider (interface, via BaseAgent)
 * - ApprovalService (via services/)
 * - WorkflowContext types
 */

import { BaseAgent } from './base-agent';
import type { WorkflowContext } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';
import { logger } from '@/lib/logger';

const SYSTEM_PROMPT = `You are a quality assurance reviewer for e-commerce product content.
Review the generated content for quality, completeness, and brand safety.
Return ONLY valid JSON. No explanations outside the JSON.`;

export interface ReviewResult {
  overallScore: number;
  sections: {
    research: { score: number; issues: string[] };
    content: { score: number; issues: string[] };
    seo: { score: number; issues: string[] };
    landingPage: { score: number; issues: string[] };
    images: { score: number; issues: string[] };
  };
  summary: string;
  recommendations: string[];
  readyForPublishing: boolean;
}

export class ReviewAgent extends BaseAgent {
  readonly name = 'ReviewAgent';

  constructor(aiProvider?: AIProvider) {
    super(aiProvider);
  }

  async execute(context: WorkflowContext): Promise<WorkflowContext> {
    logger.info({ workflowId: context.workflowId }, 'ReviewAgent started');

    const prompt = this.buildPrompt(context);
    const response = await this.generate(prompt, SYSTEM_PROMPT, { temperature: 0.3 });
    const review = this.parseJSON<ReviewResult>(response);

    logger.info(
      {
        workflowId: context.workflowId,
        score: review.overallScore,
        ready: review.readyForPublishing,
      },
      'ReviewAgent completed',
    );

    return {
      ...context,
      review,
    } as WorkflowContext & { review: ReviewResult };
  }

  private buildPrompt(context: WorkflowContext): string {
    return `Review the following AI-generated product content for quality and completeness:

PRODUCT: ${context.productIdea}

RESEARCH: ${context.research ? JSON.stringify(context.research).substring(0, 500) : 'NOT GENERATED'}

CONTENT: ${context.content ? JSON.stringify(context.content).substring(0, 500) : 'NOT GENERATED'}

SEO: ${context.seo ? JSON.stringify(context.seo).substring(0, 500) : 'NOT GENERATED'}

LANDING PAGE: ${context.landingPage ? JSON.stringify(context.landingPage).substring(0, 500) : 'NOT GENERATED'}

IMAGE PROMPTS: ${context.imagePrompts ? `${context.imagePrompts.length} prompts generated` : 'NOT GENERATED'}

Score each section on a scale of 1-10. Identify specific issues found.
Return a JSON object:

{
  "overallScore": 8,
  "sections": {
    "research": { "score": 8, "issues": ["issue description"] },
    "content": { "score": 9, "issues": [] },
    "seo": { "score": 7, "issues": ["issue description"] },
    "landingPage": { "score": 8, "issues": [] },
    "images": { "score": 7, "issues": ["issue description"] }
  },
  "summary": "Overall assessment paragraph",
  "recommendations": ["Specific improvement 1", "Specific improvement 2"],
  "readyForPublishing": true
}

Set readyForPublishing to true only if overallScore >= 7 and no critical issues exist.`;
  }
}
