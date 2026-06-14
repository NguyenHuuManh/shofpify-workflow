/**
 * Purpose:
 * Workflow state machine definition.
 * Defines all states, valid transitions, and state metadata.
 * Every state transition must be persisted via WorkflowService.
 *
 * Responsibilities:
 * - Define the 10 workflow states
 * - Define valid transitions between states
 * - Associate each state with its corresponding agent step
 * - Provide state naming utilities
 *
 * Dependencies:
 * - None (pure state machine, zero runtime dependencies)
 */

import type { WorkflowStepType } from '@prisma/client';

/**
 * Workflow states as defined in the architecture document.
 * These map to WorkflowStepType in the database.
 */
export enum WorkflowState {
  DRAFT = 'DRAFT',
  RESEARCHING = 'RESEARCHING',
  CONTENT_GENERATED = 'CONTENT_GENERATED',
  SEO_GENERATED = 'SEO_GENERATED',
  LANDING_GENERATED = 'LANDING_GENERATED',
  IMAGE_GENERATED = 'IMAGE_GENERATED',
  SHOPIFY_DRAFT_CREATED = 'SHOPIFY_DRAFT_CREATED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PUBLISHED = 'PUBLISHED',
}

/**
 * Valid state transitions.
 * Maps each state to the set of states it can transition to.
 */
export const STATE_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  [WorkflowState.DRAFT]: [WorkflowState.RESEARCHING],
  [WorkflowState.RESEARCHING]: [WorkflowState.CONTENT_GENERATED],
  [WorkflowState.CONTENT_GENERATED]: [WorkflowState.SEO_GENERATED],
  [WorkflowState.SEO_GENERATED]: [WorkflowState.LANDING_GENERATED],
  [WorkflowState.LANDING_GENERATED]: [WorkflowState.IMAGE_GENERATED],
  [WorkflowState.IMAGE_GENERATED]: [WorkflowState.SHOPIFY_DRAFT_CREATED],
  [WorkflowState.SHOPIFY_DRAFT_CREATED]: [WorkflowState.PENDING_REVIEW],
  [WorkflowState.PENDING_REVIEW]: [
    WorkflowState.APPROVED,
    WorkflowState.REJECTED,
  ],
  [WorkflowState.APPROVED]: [WorkflowState.PUBLISHED],
  [WorkflowState.REJECTED]: [WorkflowState.DRAFT],
  [WorkflowState.PUBLISHED]: [], // Terminal state
};

/**
 * Maps workflow states to their corresponding WorkflowStepType.
 */
export const STATE_TO_STEP: Partial<Record<WorkflowState, WorkflowStepType>> = {
  [WorkflowState.RESEARCHING]: 'RESEARCH',
  [WorkflowState.CONTENT_GENERATED]: 'CONTENT',
  [WorkflowState.SEO_GENERATED]: 'SEO',
  [WorkflowState.LANDING_GENERATED]: 'LANDING',
  [WorkflowState.IMAGE_GENERATED]: 'IMAGE',
  [WorkflowState.SHOPIFY_DRAFT_CREATED]: 'SHOPIFY',
  [WorkflowState.PENDING_REVIEW]: 'REVIEW',
  [WorkflowState.APPROVED]: 'PUBLISH',
};

/**
 * Maps WorkflowStepType to the state achieved after completion.
 */
export const STEP_TO_STATE: Record<WorkflowStepType, WorkflowState> = {
  RESEARCH: WorkflowState.RESEARCHING,
  CONTENT: WorkflowState.CONTENT_GENERATED,
  SEO: WorkflowState.SEO_GENERATED,
  LANDING: WorkflowState.LANDING_GENERATED,
  IMAGE: WorkflowState.IMAGE_GENERATED,
  SHOPIFY: WorkflowState.SHOPIFY_DRAFT_CREATED,
  REVIEW: WorkflowState.PENDING_REVIEW,
  PUBLISH: WorkflowState.PUBLISHED,
};

/**
 * Check if a transition from one state to another is valid.
 */
export function isValidTransition(
  from: WorkflowState,
  to: WorkflowState,
): boolean {
  const allowed = STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Get the human-readable label for a state.
 */
export function getStateLabel(state: WorkflowState): string {
  const labels: Record<WorkflowState, string> = {
    [WorkflowState.DRAFT]: 'Draft',
    [WorkflowState.RESEARCHING]: 'Researching',
    [WorkflowState.CONTENT_GENERATED]: 'Content Generated',
    [WorkflowState.SEO_GENERATED]: 'SEO Generated',
    [WorkflowState.LANDING_GENERATED]: 'Landing Page Generated',
    [WorkflowState.IMAGE_GENERATED]: 'Images Generated',
    [WorkflowState.SHOPIFY_DRAFT_CREATED]: 'Shopify Draft Created',
    [WorkflowState.PENDING_REVIEW]: 'Pending Review',
    [WorkflowState.APPROVED]: 'Approved',
    [WorkflowState.REJECTED]: 'Rejected',
    [WorkflowState.PUBLISHED]: 'Published',
  };
  return labels[state] ?? state;
}

/**
 * Check if a state is terminal (no further transitions).
 */
export function isTerminalState(state: WorkflowState): boolean {
  const transitions = STATE_TRANSITIONS[state];
  return !transitions || transitions.length === 0;
}

/**
 * Get the next state(s) from the current state.
 */
export function getNextStates(state: WorkflowState): WorkflowState[] {
  return STATE_TRANSITIONS[state] ?? [];
}
