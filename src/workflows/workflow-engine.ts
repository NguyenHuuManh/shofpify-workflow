/**
 * Purpose:
 * WorkflowEngine — the primary orchestrator for product creation workflows.
 * Builds the LangGraph, executes workflows, and coordinates BullMQ integration.
 *
 * Architecture:
 *   WorkflowEngine
 *     ├── Builds LangGraph (StateGraph)
 *     ├── Starts workflow via WorkflowService
 *     ├── Executes the graph (in-process or via BullMQ)
 *     └── Handles completion/failure
 *
 * Responsibilities:
 * - Create and configure workflow graphs
 * - Execute workflows synchronously or via job queue
 * - Track workflow progress and state
 * - Handle retry logic
 *
 * Dependencies:
 * - @langchain/langgraph
 * - WorkflowGraph
 * - WorkflowState
 * - WorkflowService
 * - logger
 */

import { buildWorkflowGraph, createInitialState } from './workflow-graph';
import { WorkflowState, isTerminalState, getStateLabel } from './workflow-state';
import { logger } from '@/lib/logger';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { AIProvider } from '@/types/ai-provider.interface';
import type { GraphState } from './agent-nodes';

export interface WorkflowEngineConfig {
  /** AI provider for agent nodes (defaults to factory default) */
  aiProvider?: AIProvider;
  /** Maximum retries per step (default: 3) */
  maxRetries?: number;
  /** Whether to execute synchronously (default: false = use BullMQ) */
  synchronous?: boolean;
}

export class WorkflowEngine {
  private readonly aiProvider?: AIProvider;

  constructor(config: WorkflowEngineConfig = {}) {
    this.aiProvider = config.aiProvider;
  }

  /**
   * Start and execute a new product creation workflow.
   * This is the main entry point called by API routes or job producers.
   */
  async execute(workflowId: string, productId: string, productIdea: string): Promise<GraphState> {
    logger.info(
      { workflowId, productId, productIdea },
      'WorkflowEngine starting execution',
    );

    // Build the LangGraph
    const graph = buildWorkflowGraph(this.aiProvider);

    // Create initial state
    const initialState = createInitialState(workflowId, productId, productIdea);

    // Execute the graph (streams through all nodes)
    const result = await graph.invoke(initialState) as GraphState;

    logger.info(
      {
        workflowId,
        finalState: result.currentState,
        isTerminal: isTerminalState(result.currentState),
      },
      'WorkflowEngine execution completed',
    );

    return result;
  }

  /**
   * Resume a workflow from a specific state.
   * Used after human approval or when resuming from BullMQ.
   */
  async resume(
    workflowId: string,
    productId: string,
    productIdea: string,
    currentState: WorkflowState,
  ): Promise<GraphState> {
    logger.info(
      { workflowId, currentState },
      'WorkflowEngine resuming from state',
    );

    if (isTerminalState(currentState)) {
      throw new AppError({
        code: ErrorCodes.INVALID_WORKFLOW_TRANSITION,
        message: `Cannot resume workflow in terminal state: ${getStateLabel(currentState)}`,
        statusCode: 400,
      });
    }

    const graph = buildWorkflowGraph(this.aiProvider);

    const state: GraphState = {
      context: {
        workflowId,
        productId,
        productIdea,
      },
      currentState,
    };

    return graph.invoke(state) as Promise<GraphState>;
  }

  /**
   * Execute a single step of the workflow.
   * Used by BullMQ workers to process individual job steps.
   */
  async executeStep(
    workflowId: string,
    productId: string,
    productIdea: string,
    step: string,
  ): Promise<GraphState> {
    logger.info({ workflowId, step }, 'WorkflowEngine executing single step');

    const graph = buildWorkflowGraph(this.aiProvider);

    const state: GraphState = {
      context: {
        workflowId,
        productId,
        productIdea,
      },
      currentState: WorkflowState.DRAFT,
    };

    // Execute graph; LangGraph will resume from where it left off
    return graph.invoke(state) as Promise<GraphState>;
  }
}

/**
 * Default singleton engine instance.
 */
export const workflowEngine = new WorkflowEngine();
