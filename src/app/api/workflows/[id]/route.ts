/**
 * Purpose:
 * Workflow detail API routes.
 * GET    /api/workflows/:id — Get workflow with all steps and related data
 * POST   /api/workflows/:id — Trigger agent execution for current step
 * DELETE /api/workflows/:id — Delete workflow and reset product status
 *
 * Dependencies:
 * - WorkflowService
 * - Agents for each executable step
 * - api-helpers
 */

import type { NextResponse } from 'next/server';
import { workflowService } from '@/services/workflow.service';
import { productService } from '@/services/product.service';
import { ResearchAgent } from '@/agents/research.agent';
import { ContentAgent } from '@/agents/content.agent';
import { SEOAgent } from '@/agents/seo.agent';
import { LandingAgent } from '@/agents/landing.agent';
import { productContentRepository } from '@/repositories/product-content.repository';
import { productSEORepository } from '@/repositories/product-seo.repository';
import { landingPageRepository } from '@/repositories/landing-page.repository';
import { success, handleError } from '../../api-helpers';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const workflow = await workflowService.getById(params.id);
    return success(workflow);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const workflow = await workflowService.getById(params.id);
    const product = await productService.getById(workflow.productId);

    const context = {
      workflowId: workflow.id,
      productId: workflow.productId,
      productIdea: product.title,
    };

    let result: string;

    switch (workflow.currentStep) {
      case 'RESEARCH': {
        const agent = new ResearchAgent();
        const ctx = await agent.execute(context);
        if (ctx.researchRunId) {
          await workflowService.completeCurrentStep(workflow.id);
        }
        result = 'Research completed → RESEARCH_REVIEW';
        break;
      }
      case 'CONTENT': {
        const agent = new ContentAgent();
        const ctx = await agent.execute(context);
        if (ctx.content) {
          await productContentRepository.upsert(workflow.productId, {
            headline: ctx.content.headline,
            subHeadline: ctx.content.subHeadline,
            description: ctx.content.description,
            benefits: ctx.content.benefits,
            features: ctx.content.features,
            faq: ctx.content.faq,
          });
          await workflowService.completeCurrentStep(workflow.id);
        }
        result = 'Content completed → CONTENT_REVIEW';
        break;
      }
      case 'SEO': {
        const agent = new SEOAgent();
        const ctx = await agent.execute(context);
        if (ctx.seo) {
          await productSEORepository.upsert(workflow.productId, {
            metaTitle: ctx.seo.metaTitle,
            metaDescription: ctx.seo.metaDescription,
            slug: ctx.seo.slug,
            keywords: ctx.seo.keywords,
          });
          await workflowService.completeCurrentStep(workflow.id);
        }
        result = 'SEO completed → SEO_REVIEW';
        break;
      }
      case 'LANDING': {
        const agent = new LandingAgent();
        const ctx = await agent.execute(context);
        if (ctx.landingPage) {
          await landingPageRepository.upsert(workflow.productId, {
            sections: ctx.landingPage.sections,
          });
          await workflowService.completeCurrentStep(workflow.id);
        }
        result = 'Landing page completed → LANDING_REVIEW';
        break;
      }
      case 'IMAGE': {
        // Image agent generates prompts only (controlled by ENABLE_IMAGE_GENERATION flag)
        const { ImageAgent } = await import('@/agents/image.agent');
        const agent = new ImageAgent();
        await agent.execute(context);
        // Image prompts are stored in context only for now; just advance the step
        await workflowService.completeCurrentStep(workflow.id);
        result = 'Image prompts generated → SHOPIFY_DRAFT';
        break;
      }
      case 'SHOPIFY': {
        // Shopify agent creates draft products — skip for now (needs Shopify API)
        await workflowService.completeCurrentStep(workflow.id);
        result = 'Shopify draft creation skipped (not configured) → FINAL_REVIEW';
        break;
      }
      case 'PUBLISH': {
        await workflowService.complete(workflow.id);
        result = 'Workflow completed → PUBLISHED';
        break;
      }
      default:
        return success({
          workflowId: params.id,
          currentStep: workflow.currentStep,
          message: `No agent for step '${workflow.currentStep}'`,
        });
    }

    logger.info({ workflowId: params.id, currentStep: workflow.currentStep }, result);

    return success({
      workflowId: params.id,
      currentStep: workflow.currentStep,
      message: result,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const workflow = await workflowService.delete(params.id);

    logger.info({ workflowId: params.id }, 'Workflow deleted via API');

    return success({
      workflowId: params.id,
      productId: workflow.productId,
      message: 'Workflow deleted',
    });
  } catch (error) {
    return handleError(error);
  }
}
