/**
 * Purpose:
 * Agent node wrappers for LangGraph integration.
 * Each node wraps an agent and handles state persistence, error handling,
 * and transitions. Review nodes pause for human input; generation nodes
 * produce content and transition to corresponding review gates.
 *
 * Responsibilities:
 * - Wrap each agent as a LangGraph-compatible node
 * - Create review gate nodes that pause for human approval
 * - Persist context updates via WorkflowService
 * - Handle agent failures with retry and state rollback
 * - Emit audit events on each step completion
 *
 * Dependencies:
 * - All agents (research, content, seo, landing, image, shopify, review, publish)
 * - WorkflowService
 * - AIProvider (interface)
 * - WorkflowState
 */

import type { WorkflowContext } from '@/types';
import type { AIProvider } from '@/types/ai-provider.interface';
import { ResearchAgent } from '@/agents/research.agent';
import { ContentAgent } from '@/agents/content.agent';
import { SEOAgent } from '@/agents/seo.agent';
import { LandingAgent } from '@/agents/landing.agent';
import { ImageAgent } from '@/agents/image.agent';
import { ShopifyAgent } from '@/agents/shopify.agent';
import { PublishAgent } from '@/agents/publish.agent';
import { workflowService } from '@/services/workflow.service';
import { productContentRepository } from '@/repositories/product-content.repository';
import { productSEORepository } from '@/repositories/product-seo.repository';
import { landingPageRepository } from '@/repositories/landing-page.repository';
import { logger } from '@/lib/logger';
import { WorkflowState } from './workflow-state';

/**
 * Graph state shape flowing through LangGraph nodes.
 */
export interface GraphState {
  context: WorkflowContext;
  currentState: WorkflowState;
  error?: string;
}

// =============================================================================
// Generation Nodes
// =============================================================================

/**
 * Create a research node for the LangGraph.
 * Transitions: DRAFT → RESEARCHING → RESEARCH_REVIEW
 */
export function createResearchNode(aiProvider?: AIProvider) {
  const agent = new ResearchAgent(aiProvider);

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Executing Research node');
    try {
      const updatedContext = await agent.execute(state.context);

      await workflowService.completeCurrentStep(state.context.workflowId);
      return {
        context: updatedContext,
        currentState: WorkflowState.RESEARCHING,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ workflowId: state.context.workflowId, error: message }, 'Research node failed');
      await workflowService.failCurrentStep(state.context.workflowId, message);
      throw error;
    }
  };
}

/**
 * Create a content node for the LangGraph.
 * Transitions: RESEARCH_REVIEW (approved) → CONTENT_GENERATING → CONTENT_REVIEW
 */
export function createContentNode(aiProvider?: AIProvider) {
  const agent = new ContentAgent(aiProvider);

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Executing Content node');
    try {
      const updatedContext = await agent.execute(state.context);

      // Persist content data to database
      if (updatedContext.content) {
        await productContentRepository.upsert(state.context.productId, {
          headline: updatedContext.content.headline,
          subHeadline: updatedContext.content.subHeadline,
          description: updatedContext.content.description,
          benefits: updatedContext.content.benefits,
          features: updatedContext.content.features,
          faq: updatedContext.content.faq,
        });
        logger.info({ workflowId: state.context.workflowId }, 'Content data persisted to DB');
      }

      await workflowService.completeCurrentStep(state.context.workflowId);
      return {
        context: updatedContext,
        currentState: WorkflowState.CONTENT_GENERATING,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await workflowService.failCurrentStep(state.context.workflowId, message);
      throw error;
    }
  };
}

/**
 * Create an SEO node for the LangGraph.
 * Transitions: CONTENT_REVIEW (approved) → SEO_GENERATING → SEO_REVIEW
 */
export function createSEONode(aiProvider?: AIProvider) {
  const agent = new SEOAgent(aiProvider);

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Executing SEO node');
    try {
      const updatedContext = await agent.execute(state.context);

      // Persist SEO data to database
      if (updatedContext.seo) {
        await productSEORepository.upsert(state.context.productId, {
          metaTitle: updatedContext.seo.metaTitle,
          metaDescription: updatedContext.seo.metaDescription,
          slug: updatedContext.seo.slug,
          keywords: updatedContext.seo.keywords,
        });
        logger.info({ workflowId: state.context.workflowId }, 'SEO data persisted to DB');
      }

      await workflowService.completeCurrentStep(state.context.workflowId);
      return {
        context: updatedContext,
        currentState: WorkflowState.SEO_GENERATING,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await workflowService.failCurrentStep(state.context.workflowId, message);
      throw error;
    }
  };
}

/**
 * Create a landing page node for the LangGraph.
 * Transitions: SEO_REVIEW (approved) → LANDING_GENERATING → LANDING_REVIEW
 */
export function createLandingNode(aiProvider?: AIProvider) {
  const agent = new LandingAgent(aiProvider);

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Executing Landing node');
    try {
      const updatedContext = await agent.execute(state.context);

      // Persist landing page data to database
      if (updatedContext.landingPage) {
        await landingPageRepository.upsert(state.context.productId, {
          sections: updatedContext.landingPage.sections,
        });
        logger.info({ workflowId: state.context.workflowId }, 'Landing page data persisted to DB');
      }

      await workflowService.completeCurrentStep(state.context.workflowId);
      return {
        context: updatedContext,
        currentState: WorkflowState.LANDING_GENERATING,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await workflowService.failCurrentStep(state.context.workflowId, message);
      throw error;
    }
  };
}

/**
 * Create an image node for the LangGraph.
 * Transitions: LANDING_REVIEW (approved) → IMAGE_GENERATING → SHOPIFY_DRAFT_CREATING
 */
export function createImageNode(aiProvider?: AIProvider) {
  const agent = new ImageAgent(aiProvider);

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Executing Image node');
    try {
      const updatedContext = await agent.execute(state.context);
      await workflowService.completeCurrentStep(state.context.workflowId);
      return {
        context: updatedContext,
        currentState: WorkflowState.IMAGE_GENERATING,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await workflowService.failCurrentStep(state.context.workflowId, message);
      throw error;
    }
  };
}

/**
 * Create a Shopify node for the LangGraph.
 * Transitions: IMAGE_GENERATING → SHOPIFY_DRAFT_CREATING → FINAL_REVIEW
 */
export function createShopifyNode(aiProvider?: AIProvider) {
  const agent = new ShopifyAgent(aiProvider);

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Executing Shopify node');
    try {
      const updatedContext = await agent.execute(state.context);
      await workflowService.completeCurrentStep(state.context.workflowId);
      return {
        context: updatedContext,
        currentState: WorkflowState.SHOPIFY_DRAFT_CREATING,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await workflowService.failCurrentStep(state.context.workflowId, message);
      throw error;
    }
  };
}

/**
 * Create a publish node for the LangGraph.
 * Transitions: APPROVED → PUBLISHED
 */
export function createPublishNode(aiProvider?: AIProvider) {
  const agent = new PublishAgent(aiProvider);

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Executing Publish node');
    try {
      const updatedContext = await agent.execute(state.context);
      await workflowService.completeCurrentStep(state.context.workflowId);
      return {
        context: updatedContext,
        currentState: WorkflowState.PUBLISHED,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await workflowService.failCurrentStep(state.context.workflowId, message);
      throw error;
    }
  };
}

// =============================================================================
// Review Gate Nodes (pause for human input)
// =============================================================================

/**
 * Create a research review gate node.
 * Pauses the graph — waits for human approval via API before proceeding.
 * On approve → CONTENT_GENERATING. On reject → RESEARCHING (rework) or REJECTED.
 */
export function createResearchReviewNode() {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Research review gate — awaiting human decision');
    // Do NOT call completeCurrentStep — the review API handles step completion
    return {
      currentState: WorkflowState.RESEARCH_REVIEW,
    };
  };
}

/**
 * Create a content review gate node.
 */
export function createContentReviewNode() {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Content review gate — awaiting human decision');
    // Do NOT call completeCurrentStep — the review API handles step completion
    return {
      currentState: WorkflowState.CONTENT_REVIEW,
    };
  };
}

/**
 * Create an SEO review gate node.
 */
export function createSEOReviewNode() {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'SEO review gate — awaiting human decision');
    // Do NOT call completeCurrentStep — the review API handles step completion
    return {
      currentState: WorkflowState.SEO_REVIEW,
    };
  };
}

/**
 * Create a landing page review gate node.
 */
export function createLandingReviewNode() {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Landing review gate — awaiting human decision');
    // Do NOT call completeCurrentStep — the review API handles step completion
    return {
      currentState: WorkflowState.LANDING_REVIEW,
    };
  };
}

/**
 * Create a final review gate node.
 * Last gate before APPROVED → PUBLISHED.
 */
export function createFinalReviewNode() {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Final review gate — awaiting human decision');
    // Do NOT call completeCurrentStep — the review API handles step completion
    return {
      currentState: WorkflowState.FINAL_REVIEW,
    };
  };
}
