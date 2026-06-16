/**
 * Purpose:
 * LangGraph StateGraph definition for the product creation workflow.
 * Defines the complete DAG of agent nodes with intermediate review gates.
 *
 * Architecture: LangGraph → AgentNodes → Agents → AIProvider/Service Layer
 *
 * Graph Structure (with per-step review gates):
 *   [RESEARCH] → [RESEARCH_REVIEW] → [CONTENT] → [CONTENT_REVIEW] → [SEO]
 *   → [SEO_REVIEW] → [LANDING] → [LANDING_REVIEW] → [IMAGE] → [SHOPIFY]
 *   → [FINAL_REVIEW] → [PUBLISH]
 *
 * Review gates pause execution. Human approval via API resumes the graph
 * from the review state. Rejection loops back to the generating step (max 3x).
 *
 * Dependencies:
 * - @langchain/langgraph
 * - AgentNodes
 * - WorkflowState
 * - logger
 */

import { StateGraph, END, Annotation } from '@langchain/langgraph';
import {
  createResearchNode,
  createResearchReviewNode,
  createContentNode,
  createContentReviewNode,
  createSEONode,
  createSEOReviewNode,
  createLandingNode,
  createLandingReviewNode,
  createImageNode,
  createShopifyNode,
  createFinalReviewNode,
  createPublishNode,
} from './agent-nodes';
import type { GraphState } from './agent-nodes';
import { WorkflowState, MAX_REWORKS_PER_STEP } from './workflow-state';
import { logger } from '@/lib/logger';
import type { AIProvider } from '@/types/ai-provider.interface';

/**
 * State annotation for LangGraph.
 */
const WorkflowAnnotation = Annotation.Root({
  context: Annotation<GraphState['context']>({
    reducer: (_prev: GraphState['context'], next: GraphState['context']) => next,
    default: () => ({ workflowId: '', productId: '', productIdea: '' }),
  }),
  currentState: Annotation<WorkflowState>({
    reducer: (_prev: WorkflowState, next: WorkflowState) => next,
    default: () => WorkflowState.DRAFT,
  }),
  error: Annotation<string | undefined>({
    reducer: (_prev: string | undefined, next: string | undefined) => next,
    default: () => undefined,
  }),
});

// =============================================================================
// Review Gate Routing
// =============================================================================

/**
 * Route from a review gate based on the review decision stored in context.
 */
function routeFromReview(
  state: GraphState,
  reviewState: WorkflowState,
  approvedNext: string,
  reworkNext: string,
): string {
  const reviewKey = getReviewKey(reviewState);
  const reviews = state.context.reviews;
  const status = reviews?.[reviewKey];

  if (!status) {
    // No decision yet — end graph, wait for human input
    logger.info({ workflowId: state.context.workflowId, reviewState }, 'Review pending human decision');
    return 'end';
  }

  if (status.status === 'APPROVED') {
    logger.info({ workflowId: state.context.workflowId, reviewState }, 'Review approved → advancing');
    return approvedNext;
  }

  if (status.status === 'REJECTED') {
    if (status.reworkCount >= MAX_REWORKS_PER_STEP) {
      logger.warn({ workflowId: state.context.workflowId, reviewState, reworkCount: status.reworkCount }, 'Max reworks exceeded → terminating');
      return 'end';
    }
    logger.info({ workflowId: state.context.workflowId, reviewState, reworkCount: status.reworkCount }, 'Review rejected → reworking');
    return reworkNext;
  }

  return 'end';
}

function getReviewKey(state: WorkflowState): 'research' | 'content' | 'seo' | 'landing' | 'final' {
  const map: Record<string, 'research' | 'content' | 'seo' | 'landing' | 'final'> = {
    [WorkflowState.RESEARCH_REVIEW]: 'research',
    [WorkflowState.CONTENT_REVIEW]: 'content',
    [WorkflowState.SEO_REVIEW]: 'seo',
    [WorkflowState.LANDING_REVIEW]: 'landing',
    [WorkflowState.FINAL_REVIEW]: 'final',
  };
  return map[state] ?? 'final';
}

// =============================================================================
// Graph Builder
// =============================================================================

/**
 * Build the complete product creation workflow as a LangGraph StateGraph.
 * Includes per-step review gates: research, content, seo, landing, final.
 */
export function buildWorkflowGraph(aiProvider?: AIProvider) {
  const graph = new StateGraph(WorkflowAnnotation)
    // Generation nodes
    .addNode('research', createResearchNode(aiProvider))
    .addNode('content', createContentNode(aiProvider))
    .addNode('seo', createSEONode(aiProvider))
    .addNode('landing', createLandingNode(aiProvider))
    .addNode('image', createImageNode(aiProvider))
    .addNode('shopify', createShopifyNode(aiProvider))

    // Review gate nodes
    .addNode('researchReview', createResearchReviewNode())
    .addNode('contentReview', createContentReviewNode())
    .addNode('seoReview', createSEOReviewNode())
    .addNode('landingReview', createLandingReviewNode())
    .addNode('finalReview', createFinalReviewNode())

    // Publish node
    .addNode('publish', createPublishNode(aiProvider))

    // Edges: generation → review
    .addEdge('__start__', 'research')
    .addEdge('research', 'researchReview')
    .addEdge('content', 'contentReview')
    .addEdge('seo', 'seoReview')
    .addEdge('landing', 'landingReview')
    .addEdge('image', 'shopify')
    .addEdge('shopify', 'finalReview')

    // Review routing — approve → next step, reject → rework, no decision → END (pause)
    .addConditionalEdges('researchReview', (s) => routeFromReview(s, WorkflowState.RESEARCH_REVIEW, 'content', 'research'), {
      content: 'content',
      research: 'research',
      end: END,
    })
    .addConditionalEdges('contentReview', (s) => routeFromReview(s, WorkflowState.CONTENT_REVIEW, 'seo', 'content'), {
      seo: 'seo',
      content: 'content',
      end: END,
    })
    .addConditionalEdges('seoReview', (s) => routeFromReview(s, WorkflowState.SEO_REVIEW, 'landing', 'seo'), {
      landing: 'landing',
      seo: 'seo',
      end: END,
    })
    .addConditionalEdges('landingReview', (s) => routeFromReview(s, WorkflowState.LANDING_REVIEW, 'image', 'landing'), {
      image: 'image',
      landing: 'landing',
      end: END,
    })
    .addConditionalEdges('finalReview', (s) => routeFromReview(s, WorkflowState.FINAL_REVIEW, 'publish', 'end'), {
      publish: 'publish',
      end: END,
    })

    .addEdge('publish', END);

  return graph.compile();
}

/**
 * Create the initial graph state for a new workflow execution.
 */
export function createInitialState(
  workflowId: string,
  productId: string,
  productIdea: string,
): GraphState {
  return {
    context: { workflowId, productId, productIdea },
    currentState: WorkflowState.DRAFT,
  };
}
