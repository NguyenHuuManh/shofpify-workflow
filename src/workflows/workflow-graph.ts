/**
 * Purpose:
 * LangGraph StateGraph definition for the product creation workflow.
 * Defines the complete DAG of agent nodes and the routing logic.
 *
 * Architecture: LangGraph → AgentNodes → Agents → AIProvider/Service Layer
 *
 * Graph Structure:
 *   [RESEARCH] → [CONTENT] → [SEO] → [LANDING] → [IMAGE] → [SHOPIFY] → [REVIEW]
 *                                                                          ↓
 *                                                              [APPROVED] [REJECTED]
 *                                                                   ↓
 *                                                              [PUBLISH]
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
  createContentNode,
  createSEONode,
  createLandingNode,
  createImageNode,
  createShopifyNode,
  createReviewNode,
  createPublishNode,
} from './agent-nodes';
import type { GraphState } from './agent-nodes';
import { WorkflowState } from './workflow-state';
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

/**
 * Build the complete product creation workflow as a LangGraph StateGraph.
 */
export function buildWorkflowGraph(aiProvider?: AIProvider) {
  // Use chaining for typed node registration
  const graph = new StateGraph(WorkflowAnnotation)
    .addNode('research', createResearchNode(aiProvider))
    .addNode('content', createContentNode(aiProvider))
    .addNode('seo', createSEONode(aiProvider))
    .addNode('landing', createLandingNode(aiProvider))
    .addNode('image', createImageNode(aiProvider))
    .addNode('shopify', createShopifyNode(aiProvider))
    .addNode('review', createReviewNode(aiProvider))
    .addNode('publish', createPublishNode(aiProvider))

    .addEdge('__start__', 'research')
    .addEdge('research', 'content')
    .addEdge('content', 'seo')
    .addEdge('seo', 'landing')
    .addEdge('landing', 'image')
    .addEdge('image', 'shopify')
    .addEdge('shopify', 'review')

    .addConditionalEdges('review', afterReview, {
      publish: 'publish',
      end: END,
    })

    .addEdge('publish', END);

  return graph.compile();
}

function afterReview(state: GraphState): 'publish' | 'end' {
  const extended = state.context as unknown as Record<string, unknown> & {
    review?: { readyForPublishing?: boolean };
  };

  if (extended.review?.readyForPublishing) {
    logger.info({ workflowId: state.context.workflowId }, 'Review passed → routing to publish');
    return 'publish';
  }

  logger.info({ workflowId: state.context.workflowId }, 'Review requires human approval → ending graph');
  return 'end';
}

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
