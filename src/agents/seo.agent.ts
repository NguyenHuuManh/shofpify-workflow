/**
 * Purpose:
 * SEOAgent — generates SEO metadata including meta title, meta description,
 * URL slug, and keyword strategy.
 *
 * Architecture: Agent → AIProvider (interface)
 *
 * Responsibilities:
 * - Generate SEO-optimized meta title (50-60 chars)
 * - Write compelling meta description (150-160 chars)
 * - Create URL-friendly slug
 * - Identify primary and secondary keywords
 * - Ensure keyword density and relevance
 *
 * Dependencies:
 * - AIProvider (interface, via BaseAgent)
 * - WorkflowContext types
 */

import { BaseAgent } from './base-agent';
import type { WorkflowContext, ProductSEOResult } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';
import { logger } from '@/lib/logger';

const SYSTEM_PROMPT = `You are an expert SEO strategist for e-commerce.
Optimize product pages for search engines while maintaining readability.
Return ONLY valid JSON. No explanations outside the JSON.`;

export class SEOAgent extends BaseAgent {
  readonly name = 'SEOAgent';

  constructor(aiProvider?: AIProvider) {
    super(aiProvider);
  }

  async execute(context: WorkflowContext): Promise<WorkflowContext> {
    logger.info({ workflowId: context.workflowId }, 'SEOAgent started');

    if (!context.content) {
      logger.warn({ workflowId: context.workflowId }, 'SEOAgent running without content data');
    }

    const prompt = this.buildPrompt(context);
    const response = await this.generate(prompt, SYSTEM_PROMPT, { temperature: 0.5 });
    const seo = this.parseJSON<ProductSEOResult>(response);

    this.validateSEO(seo);

    logger.info({ workflowId: context.workflowId, slug: seo.slug }, 'SEOAgent completed');

    return {
      ...context,
      seo,
    };
  }

  private buildPrompt(context: WorkflowContext): string {
    const contentContext = context.content
      ? `PRODUCT CONTENT:\n- Headline: ${context.content.headline}\n- Description: ${context.content.description.substring(0, 300)}...`
      : '';

    return `Generate SEO metadata for:

PRODUCT: ${context.productIdea}
${contentContext}

Return a JSON object with exactly this structure:

{
  "metaTitle": "SEO-optimized title tag (50-60 characters, include primary keyword)",
  "metaDescription": "Compelling meta description (150-160 characters, include CTA and primary keyword)",
  "slug": "url-friendly-product-slug",
  "keywords": ["primary keyword", "secondary keyword 1", "secondary keyword 2", "secondary keyword 3", "secondary keyword 4", "long-tail keyword 1", "long-tail keyword 2", "long-tail keyword 3"]
}

Rules:
- Meta title: Include brand-relevant primary keyword, keep under 60 chars
- Meta description: Include value proposition + CTA, keep under 160 chars
- Slug: lowercase, hyphens, no special chars, include primary keyword
- Keywords: 8 keywords total, mix of short-tail and long-tail, sorted by search volume potential`;
  }

  private validateSEO(seo: ProductSEOResult): void {
    if (!seo.metaTitle || !seo.metaDescription || !seo.slug || !seo.keywords) {
      throw new Error('SEOAgent: AI response missing required fields');
    }
    if (!Array.isArray(seo.keywords) || seo.keywords.length === 0) {
      throw new Error('SEOAgent: keywords must be a non-empty array');
    }
  }
}
