/**
 * Purpose:
 * LandingAgent — generates a complete landing page structure with
 * hero section, benefits, features, testimonials, FAQ, and CTA.
 *
 * Architecture: Agent → AIProvider (interface)
 *
 * Responsibilities:
 * - Generate hero section with headline, subheadline, CTA
 * - Build benefits section from research data
 * - Build features section from content data
 * - Generate placeholder testimonial copy
 * - Structure FAQ section
 * - Generate final CTA section
 *
 * Dependencies:
 * - AIProvider (interface, via BaseAgent)
 * - WorkflowContext types
 */

import { BaseAgent } from './base-agent';
import type { WorkflowContext, LandingPageResult } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';
import { logger } from '@/lib/logger';

const SYSTEM_PROMPT = `You are an expert landing page designer for e-commerce.
Create high-converting landing page structures with clear information hierarchy.
Return ONLY valid JSON. No explanations outside the JSON.`;

export class LandingAgent extends BaseAgent {
  readonly name = 'LandingAgent';

  constructor(aiProvider?: AIProvider) {
    super(aiProvider);
  }

  async execute(context: WorkflowContext): Promise<WorkflowContext> {
    logger.info({ workflowId: context.workflowId }, 'LandingAgent started');

    const prompt = this.buildPrompt(context);
    const response = await this.generate(prompt, SYSTEM_PROMPT, { temperature: 0.7 });
    const landingPage = this.parseJSON<LandingPageResult>(response);

    this.validateLandingPage(landingPage);

    logger.info({ workflowId: context.workflowId }, 'LandingAgent completed');

    return {
      ...context,
      landingPage,
    };
  }

  private buildPrompt(context: WorkflowContext): string {
    const contentRef = context.content
      ? `- Headline: ${context.content.headline}\n- Subheadline: ${context.content.subHeadline ?? 'N/A'}\n- Benefits: ${JSON.stringify(context.content.benefits)}\n- Features: ${JSON.stringify(context.content.features)}\n- FAQ: ${JSON.stringify(context.content.faq)}`
      : '';

    const seoRef = context.seo
      ? `- Meta Title: ${context.seo.metaTitle}\n- Keywords: ${context.seo.keywords.join(', ')}`
      : '';

    return `Design a complete landing page structure for:

PRODUCT: ${context.productIdea}
${contentRef}
${seoRef}

Return a JSON object with exactly this structure:

{
  "sections": {
    "hero": {
      "headline": "Main hero headline",
      "subheadline": "Supporting hero text",
      "ctaText": "Call to action button text",
      "ctaLink": "#buy-now",
      "backgroundStyle": "suggested background color/description",
      "layout": "text-left-image-right"
    },
    "benefits": {
      "title": "Why Choose [Product]",
      "subtitle": "Section subtitle",
      "items": [
        { "icon": "emoji", "title": "Benefit title", "description": "Short description" }
      ],
      "layout": "4-column-grid"
    },
    "features": {
      "title": "Technical Specifications",
      "subtitle": "Section subtitle",
      "items": [
        { "icon": "emoji", "name": "Feature name", "spec": "Specification", "detail": "Why it matters" }
      ],
      "layout": "alternating-rows"
    },
    "testimonials": {
      "title": "What Customers Say",
      "subtitle": "Section subtitle",
      "items": [
        { "name": "Customer Name", "role": "Customer Role", "quote": "Testimonial quote", "rating": 5, "avatar": "placeholder-url" }
      ],
      "layout": "3-column-cards"
    },
    "faq": {
      "title": "Frequently Asked Questions",
      "subtitle": "Section subtitle",
      "items": [
        { "question": "Question?", "answer": "Answer" }
      ],
      "layout": "accordion"
    },
    "cta": {
      "headline": "Final CTA headline",
      "subheadline": "Urgency-driving subheadline",
      "buttonText": "Final CTA button text",
      "buttonLink": "#buy-now",
      "urgencyText": "Limited stock / offer text",
      "layout": "centered-banner"
    }
  }
}`;
  }

  private validateLandingPage(page: LandingPageResult): void {
    if (!page.sections || typeof page.sections !== 'object') {
      throw new Error('LandingAgent: AI response must have sections object');
    }
    const required = ['hero', 'benefits', 'features', 'testimonials', 'faq', 'cta'];
    const sections = page.sections as Record<string, unknown>;
    for (const section of required) {
      if (!sections[section]) {
        throw new Error(`LandingAgent: missing required section: ${section}`);
      }
    }
  }
}
