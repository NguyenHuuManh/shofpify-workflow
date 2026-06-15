/**
 * Purpose:
 * WorkflowEngine — the primary orchestrator for product creation workflows.
 * Builds the LangGraph, executes workflows, and coordinates BullMQ integration.
 * Supports intermediate review gates with resume-after-approval flow.
 *
 * Architecture:
 *   WorkflowEngine
 *     ├── Builds LangGraph (StateGraph with review gates)
 *     ├── Starts workflow via WorkflowService
 *     ├── Executes the graph (in-process or via BullMQ)
 *     ├── Pauses at review gates for human input
 *     └── Resumes from review states after human decision
 *
 * Responsibilities:
 * - Create and configure workflow graphs with intermediate reviews
 * - Execute workflows synchronously or via job queue
 * - Handle resume after per-step review approval/rejection
 * - Track workflow progress and state
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
   * Runs the graph until it hits a review gate or terminal state.
   */
  async execute(workflowId: string, productId: string, productIdea: string): Promise<GraphState> {
    logger.info(
      { workflowId, productId, productIdea },
      'WorkflowEngine starting execution',
    );

    const graph = buildWorkflowGraph(this.aiProvider);
    const initialState = createInitialState(workflowId, productId, productIdea);

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
   * Used after human review decision at any review gate.
   */
  async resume(
    workflowId: string,
    productId: string,
    productIdea: string,
    currentState: WorkflowState,
    context?: GraphState['context'],
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
      context: context ?? {
        workflowId,
        productId,
        productIdea,
      },
      currentState,
    };

    const result = await graph.invoke(state) as GraphState;

    logger.info(
      {
        workflowId,
        previousState: currentState,
        finalState: result.currentState,
      },
      'WorkflowEngine resume completed',
    );

    return result;
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

    return graph.invoke(state) as Promise<GraphState>;
  }
}

export const workflowEngine = new WorkflowEngine();
