/**
 * Purpose:
 * ContentAgent — generates product content including headline, description,
 * benefits, features, FAQ, and call-to-action.
 *
 * Architecture: Agent → AIProvider (interface)
 *
 * Responsibilities:
 * - Generate compelling product headline and sub-headline
 * - Write persuasive product description
 * - List key benefits and features
 * - Generate FAQ with common customer questions
 * - Produce call-to-action copy
 *
 * Dependencies:
 * - AIProvider (interface, via BaseAgent)
 * - WorkflowContext types
 */

import { BaseAgent } from './base-agent';
import type { WorkflowContext, ProductContentResult } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';
import { logger } from '@/lib/logger';

const SYSTEM_PROMPT = `You are an expert e-commerce copywriter specializing in high-converting product pages.
Write compelling, benefit-driven copy that sells. Use the research data provided to inform your writing.
Return ONLY valid JSON. No explanations outside the JSON.`;

export class ContentAgent extends BaseAgent {
  readonly name = 'ContentAgent';

  constructor(aiProvider?: AIProvider) {
    super(aiProvider);
  }

  async execute(context: WorkflowContext): Promise<WorkflowContext> {
    logger.info({ workflowId: context.workflowId }, 'ContentAgent started');

    if (!context.research) {
      logger.warn({ workflowId: context.workflowId }, 'ContentAgent running without research data');
    }

    const prompt = this.buildPrompt(context);
    const response = await this.generate(prompt, SYSTEM_PROMPT, { temperature: 0.7 });
    const content = this.parseJSON<ProductContentResult>(response);

    this.validateContent(content);

    logger.info({ workflowId: context.workflowId }, 'ContentAgent completed');

    return {
      ...context,
      content,
    };
  }

  private buildPrompt(context: WorkflowContext): string {
    const researchContext = context.research
      ? `
RESEARCH DATA:
- Target Audience: ${JSON.stringify(context.research.targetAudience)}
- Key USPs: ${JSON.stringify(context.research.usp)}
- Pain Points: ${JSON.stringify(context.research.painPoints)}
- Market Summary: ${context.research.marketSummary}`
      : '';

    return `Write high-converting product content for:

PRODUCT: ${context.productIdea}
${researchContext}

Return a JSON object with exactly this structure:

{
  "headline": "Compelling main headline (max 70 chars)",
  "subHeadline": "Supporting sub-headline (max 120 chars)",
  "description": "Persuasive product description (3-4 paragraphs, HTML allowed for <strong> and <em>)",
  "benefits": {
    "benefit1": { "title": "Benefit Title", "description": "Detailed explanation", "icon": "suggested emoji" },
    "benefit2": { "title": "Benefit Title", "description": "Detailed explanation", "icon": "suggested emoji" },
    "benefit3": { "title": "Benefit Title", "description": "Detailed explanation", "icon": "suggested emoji" },
    "benefit4": { "title": "Benefit Title", "description": "Detailed explanation", "icon": "suggested emoji" }
  },
  "features": {
    "feature1": { "name": "Feature Name", "spec": "Technical specification", "benefit": "What it means for the customer" },
    "feature2": { "name": "Feature Name", "spec": "Technical specification", "benefit": "What it means for the customer" },
    "feature3": { "name": "Feature Name", "spec": "Technical specification", "benefit": "What it means for the customer" },
    "feature4": { "name": "Feature Name", "spec": "Technical specification", "benefit": "What it means for the customer" },
    "feature5": { "name": "Feature Name", "spec": "Technical specification", "benefit": "What it means for the customer" }
  },
  "faq": {
    "q1": { "question": "Common customer question?", "answer": "Helpful answer" },
    "q2": { "question": "Common customer question?", "answer": "Helpful answer" },
    "q3": { "question": "Common customer question?", "answer": "Helpful answer" },
    "q4": { "question": "Common customer question?", "answer": "Helpful answer" },
    "q5": { "question": "Common customer question?", "answer": "Helpful answer" }
  }
}

Make the copy benefit-driven, emotionally engaging, and optimized for conversion.
Use the research data to address specific pain points in the benefits and FAQ.`;
  }

  private validateContent(content: ProductContentResult): void {
    const required = ['headline', 'description', 'benefits', 'features', 'faq'];
    for (const field of required) {
      if (!(content as unknown as Record<string, unknown>)[field]) {
        throw new Error(`ContentAgent: AI response missing required field: ${field}`);
      }
    }
  }
}
