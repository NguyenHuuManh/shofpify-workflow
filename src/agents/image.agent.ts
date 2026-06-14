/**
 * Purpose:
 * ImageAgent — generates image generation prompts for AI image tools
 * (Midjourney, DALL-E, Stable Diffusion). Does NOT generate images directly.
 *
 * Architecture: Agent → AIProvider (interface)
 *
 * Responsibilities:
 * - Generate hero image prompt
 * - Generate product showcase image prompts
 * - Generate thumbnail prompt
 * - Generate ad creative prompts
 * - Generate landing page image prompts
 *
 * Dependencies:
 * - AIProvider (interface, via BaseAgent)
 * - WorkflowContext types
 */

import { BaseAgent } from './base-agent';
import type { WorkflowContext, ImagePrompt } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';
import { logger } from '@/lib/logger';

const SYSTEM_PROMPT = `You are an expert AI image prompt engineer.
Create detailed, descriptive image generation prompts optimized for Midjourney/DALL-E.
Focus on commercial product photography style.
Return ONLY valid JSON. No explanations outside the JSON.`;

export class ImageAgent extends BaseAgent {
  readonly name = 'ImageAgent';

  constructor(aiProvider?: AIProvider) {
    super(aiProvider);
  }

  async execute(context: WorkflowContext): Promise<WorkflowContext> {
    logger.info({ workflowId: context.workflowId }, 'ImageAgent started');

    const prompt = this.buildPrompt(context);
    const response = await this.generate(prompt, SYSTEM_PROMPT, { temperature: 0.8 });
    const result = this.parseJSON<{ prompts: ImagePrompt[] }>(response);

    if (!result.prompts || !Array.isArray(result.prompts)) {
      throw new Error('ImageAgent: AI response missing prompts array');
    }

    logger.info(
      { workflowId: context.workflowId, promptCount: result.prompts.length },
      'ImageAgent completed',
    );

    return {
      ...context,
      imagePrompts: result.prompts,
    };
  }

  private buildPrompt(context: WorkflowContext): string {
    const contentRef = context.content
      ? `- Headline: ${context.content.headline}\n- Description: ${context.content.description.substring(0, 300)}`
      : '';

    return `Generate image generation prompts for:

PRODUCT: ${context.productIdea}
${contentRef}

Create prompts optimized for Midjourney v6 / DALL-E 3. Each prompt should be detailed, including:
- Subject description
- Lighting style
- Camera angle/perspective
- Color palette
- Mood/atmosphere
- Technical quality markers (8K, photorealistic, etc.)

Return a JSON object with exactly this structure:

{
  "prompts": [
    {
      "assetType": "HERO_IMAGE",
      "prompt": "Detailed image generation prompt for the hero/banner image",
      "description": "What this image shows and where it's used on the page"
    },
    {
      "assetType": "PRODUCT_IMAGE",
      "prompt": "Detailed prompt for main product showcase on white background",
      "description": "Main product shot for the product detail section"
    },
    {
      "assetType": "PRODUCT_IMAGE",
      "prompt": "Detailed prompt for lifestyle product shot",
      "description": "Product shown in use by a customer in a real setting"
    },
    {
      "assetType": "PRODUCT_IMAGE",
      "prompt": "Detailed prompt for product detail/close-up shot",
      "description": "Close-up showing product texture, materials, or key feature"
    },
    {
      "assetType": "THUMBNAIL",
      "prompt": "Detailed prompt for product thumbnail/catalog image",
      "description": "Clean product thumbnail for collection/catalog pages"
    },
    {
      "assetType": "LANDING_IMAGE",
      "prompt": "Detailed prompt for a lifestyle image to use in the benefits section",
      "description": "Lifestyle image showing the product solving a customer problem"
    }
  ]
}`;
  }
}
