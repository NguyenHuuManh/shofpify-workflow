/**
 * Purpose:
 * Agent node wrappers for LangGraph integration.
 * Each node wraps an agent and handles state persistence, error handling,
 * and transitions. Agents never access the database directly.
 *
 * Responsibilities:
 * - Wrap each agent as a LangGraph-compatible node
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
import { ReviewAgent } from '@/agents/review.agent';
import { PublishAgent } from '@/agents/publish.agent';
import { workflowService } from '@/services/workflow.service';
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

/**
 * Create a research node for the LangGraph.
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
 */
export function createContentNode(aiProvider?: AIProvider) {
  const agent = new ContentAgent(aiProvider);

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Executing Content node');
    try {
      const updatedContext = await agent.execute(state.context);
      await workflowService.completeCurrentStep(state.context.workflowId);
      return {
        context: updatedContext,
        currentState: WorkflowState.CONTENT_GENERATED,
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
 */
export function createSEONode(aiProvider?: AIProvider) {
  const agent = new SEOAgent(aiProvider);

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Executing SEO node');
    try {
      const updatedContext = await agent.execute(state.context);
      await workflowService.completeCurrentStep(state.context.workflowId);
      return {
        context: updatedContext,
        currentState: WorkflowState.SEO_GENERATED,
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
 */
export function createLandingNode(aiProvider?: AIProvider) {
  const agent = new LandingAgent(aiProvider);

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Executing Landing node');
    try {
      const updatedContext = await agent.execute(state.context);
      await workflowService.completeCurrentStep(state.context.workflowId);
      return {
        context: updatedContext,
        currentState: WorkflowState.LANDING_GENERATED,
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
        currentState: WorkflowState.IMAGE_GENERATED,
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
        currentState: WorkflowState.SHOPIFY_DRAFT_CREATED,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await workflowService.failCurrentStep(state.context.workflowId, message);
      throw error;
    }
  };
}

/**
 * Create a review node for the LangGraph.
 */
export function createReviewNode(aiProvider?: AIProvider) {
  const agent = new ReviewAgent(aiProvider);

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    logger.info({ workflowId: state.context.workflowId }, 'Executing Review node');
    try {
      const updatedContext = await agent.execute(state.context);
      await workflowService.completeCurrentStep(state.context.workflowId);
      return {
        context: updatedContext,
        currentState: WorkflowState.PENDING_REVIEW,
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
