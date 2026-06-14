/**
 * Purpose:
 * ResearchAgent — performs market research, competitor analysis,
 * persona generation, and USP identification for a product idea.
 *
 * Architecture: Agent → AIProvider (interface)
 * Stores results via ProductResearchRepository (through service layer in Phase 5).
 *
 * Responsibilities:
 * - Analyze target audience and generate personas
 * - Identify competitors and their positioning
 * - Discover customer pain points
 * - Generate unique selling propositions (USPs)
 * - Produce market summary
 *
 * Dependencies:
 * - AIProvider (interface, via BaseAgent)
 * - WorkflowContext types
 */

import { BaseAgent } from './base-agent';
import type { WorkflowContext, ProductResearchResult } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';
import { logger } from '@/lib/logger';

const SYSTEM_PROMPT = `You are an expert market research analyst for e-commerce products.
Analyze the given product idea and produce detailed market research.
Return ONLY valid JSON in the exact format requested. No explanations outside the JSON.`;

export class ResearchAgent extends BaseAgent {
  readonly name = 'ResearchAgent';

  constructor(aiProvider?: AIProvider) {
    super(aiProvider);
  }

  async execute(context: WorkflowContext): Promise<WorkflowContext> {
    logger.info({ workflowId: context.workflowId, product: context.productIdea }, 'ResearchAgent started');

    const prompt = this.buildPrompt(context);
    const response = await this.generate(prompt, SYSTEM_PROMPT, { temperature: 0.8 });
    const research = this.parseJSON<ProductResearchResult>(response);

    // Validate required fields
    this.validateResearch(research);

    logger.info({ workflowId: context.workflowId }, 'ResearchAgent completed');

    return {
      ...context,
      research,
    };
  }

  private buildPrompt(context: WorkflowContext): string {
    return `Conduct a comprehensive market research analysis for the following product:

PRODUCT IDEA: ${context.productIdea}

Please analyze and return a JSON object with the following structure:

{
  "targetAudience": {
    "primaryPersona": "Description of the ideal customer",
    "demographics": { "age": "range", "gender": "split", "income": "level", "location": "regions" },
    "interests": ["interest1", "interest2"],
    "behaviorPatterns": ["pattern1", "pattern2"]
  },
  "competitors": {
    "direct": [
      { "name": "Competitor A", "strengths": ["s1"], "weaknesses": ["w1"], "priceRange": "$X-$Y", "marketShare": "estimate" }
    ],
    "indirect": [
      { "name": "Competitor B", "description": "alternative solution" }
    ]
  },
  "painPoints": {
    "primary": ["pain point 1", "pain point 2"],
    "secondary": ["pain point 3"],
    "severity": { "pain point 1": "high|medium|low" }
  },
  "usp": {
    "primary": "Main unique selling proposition",
    "supporting": ["USP 2", "USP 3"],
    "differentiation": "How this product differs from competitors"
  },
  "marketSummary": "A 2-3 sentence summary of the market opportunity for this product"
}

Be thorough and specific. Use realistic data. Think step by step about the market.`;
  }

  private validateResearch(research: ProductResearchResult): void {
    if (!research.targetAudience || !research.competitors || !research.painPoints || !research.usp || !research.marketSummary) {
      throw new Error('ResearchAgent: AI response missing required fields');
    }
  }
}
