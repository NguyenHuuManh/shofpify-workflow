/**
 * Purpose:
 * Workflow state machine definition.
 * Defines all states, valid transitions, and state metadata.
 * Every state transition must be persisted via WorkflowService.
 *
 * Responsibilities:
 * - Define the 17 workflow states (including per-step review gates)
 * - Define valid transitions between states (including rework loops)
 * - Associate each state with its corresponding agent step
 * - Provide state naming utilities
 *
 * Dependencies:
 * - None (pure state machine, zero runtime dependencies)
 */

import type { WorkflowStepType } from '@prisma/client';

/**
 * Workflow states including intermediate review gates.
 * Matches the state machine defined in 06-deepseek.md.
 */
export enum WorkflowState {
  DRAFT = 'DRAFT',
  RESEARCHING = 'RESEARCHING',
  RESEARCH_REVIEW = 'RESEARCH_REVIEW',
  CONTENT_GENERATING = 'CONTENT_GENERATING',
  CONTENT_REVIEW = 'CONTENT_REVIEW',
  SEO_GENERATING = 'SEO_GENERATING',
  SEO_REVIEW = 'SEO_REVIEW',
  LANDING_GENERATING = 'LANDING_GENERATING',
  LANDING_REVIEW = 'LANDING_REVIEW',
  IMAGE_GENERATING = 'IMAGE_GENERATING',
  SHOPIFY_DRAFT_CREATING = 'SHOPIFY_DRAFT_CREATING',
  FINAL_REVIEW = 'FINAL_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PUBLISHED = 'PUBLISHED',
}

/**
 * Maximum number of reworks allowed per step before forcing rejection.
 */
export const MAX_REWORKS_PER_STEP = 3;

/**
 * Valid state transitions.
 * Maps each state to the set of states it can transition to.
 */
export const STATE_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  [WorkflowState.DRAFT]: [WorkflowState.CONTENT_GENERATING],

  // Research phase
  [WorkflowState.RESEARCHING]: [WorkflowState.RESEARCH_REVIEW],
  [WorkflowState.RESEARCH_REVIEW]: [
    WorkflowState.CONTENT_GENERATING,   // approved
    WorkflowState.RESEARCHING,          // rejected → rework
    WorkflowState.REJECTED,             // rejected → max reworks exceeded
  ],

  // Content phase
  [WorkflowState.CONTENT_GENERATING]: [WorkflowState.CONTENT_REVIEW],
  [WorkflowState.CONTENT_REVIEW]: [
    WorkflowState.SEO_GENERATING,       // approved
    WorkflowState.CONTENT_GENERATING,   // rejected → rework
    WorkflowState.REJECTED,             // rejected → max reworks exceeded
  ],

  // SEO phase
  [WorkflowState.SEO_GENERATING]: [WorkflowState.SEO_REVIEW],
  [WorkflowState.SEO_REVIEW]: [
    WorkflowState.LANDING_GENERATING,   // approved
    WorkflowState.SEO_GENERATING,       // rejected → rework
    WorkflowState.REJECTED,             // rejected → max reworks exceeded
  ],

  // Landing phase
  [WorkflowState.LANDING_GENERATING]: [WorkflowState.LANDING_REVIEW],
  [WorkflowState.LANDING_REVIEW]: [
    WorkflowState.IMAGE_GENERATING,     // approved
    WorkflowState.LANDING_GENERATING,   // rejected → rework
    WorkflowState.REJECTED,             // rejected → max reworks exceeded
  ],

  // Image + Shopify (no intermediate review — flows through)
  [WorkflowState.IMAGE_GENERATING]: [WorkflowState.SHOPIFY_DRAFT_CREATING],
  [WorkflowState.SHOPIFY_DRAFT_CREATING]: [WorkflowState.FINAL_REVIEW],

  // Final review
  [WorkflowState.FINAL_REVIEW]: [
    WorkflowState.APPROVED,
    WorkflowState.REJECTED,
  ],

  // Terminal
  [WorkflowState.APPROVED]: [WorkflowState.PUBLISHED],
  [WorkflowState.REJECTED]: [],
  [WorkflowState.PUBLISHED]: [], // Terminal state
};

/**
 * Maps workflow states to their corresponding WorkflowStepType.
 */
export const STATE_TO_STEP: Partial<Record<WorkflowState, WorkflowStepType>> = {
  [WorkflowState.RESEARCHING]: 'RESEARCH',
  [WorkflowState.RESEARCH_REVIEW]: 'RESEARCH_REVIEW',
  [WorkflowState.CONTENT_GENERATING]: 'CONTENT',
  [WorkflowState.CONTENT_REVIEW]: 'CONTENT_REVIEW',
  [WorkflowState.SEO_GENERATING]: 'SEO',
  [WorkflowState.SEO_REVIEW]: 'SEO_REVIEW',
  [WorkflowState.LANDING_GENERATING]: 'LANDING',
  [WorkflowState.LANDING_REVIEW]: 'LANDING_REVIEW',
  [WorkflowState.IMAGE_GENERATING]: 'IMAGE',
  [WorkflowState.SHOPIFY_DRAFT_CREATING]: 'SHOPIFY',
  [WorkflowState.FINAL_REVIEW]: 'FINAL_REVIEW',
  [WorkflowState.APPROVED]: 'PUBLISH',
};

/**
 * Maps WorkflowStepType to the state achieved after completion.
 */
export const STEP_TO_STATE: Record<WorkflowStepType, WorkflowState> = {
  RESEARCH: WorkflowState.RESEARCHING,
  RESEARCH_REVIEW: WorkflowState.RESEARCH_REVIEW,
  CONTENT: WorkflowState.CONTENT_GENERATING,
  CONTENT_REVIEW: WorkflowState.CONTENT_REVIEW,
  SEO: WorkflowState.SEO_GENERATING,
  SEO_REVIEW: WorkflowState.SEO_REVIEW,
  LANDING: WorkflowState.LANDING_GENERATING,
  LANDING_REVIEW: WorkflowState.LANDING_REVIEW,
  IMAGE: WorkflowState.IMAGE_GENERATING,
  SHOPIFY: WorkflowState.SHOPIFY_DRAFT_CREATING,
  REVIEW: WorkflowState.FINAL_REVIEW,
  FINAL_REVIEW: WorkflowState.FINAL_REVIEW,
  PUBLISH: WorkflowState.PUBLISHED,
};

/**
 * Review states that require human decision.
 */
export const REVIEW_STATES: WorkflowState[] = [
  WorkflowState.RESEARCH_REVIEW,
  WorkflowState.CONTENT_REVIEW,
  WorkflowState.SEO_REVIEW,
  WorkflowState.LANDING_REVIEW,
  WorkflowState.FINAL_REVIEW,
];

/**
 * Check if a state is a review gate (requires human input).
 */
export function isReviewState(state: WorkflowState): boolean {
  return REVIEW_STATES.includes(state);
}

/**
 * Get the generating state that precedes a given review state (for rework loops).
 */
export function getPrecedingGeneratingState(reviewState: WorkflowState): WorkflowState | null {
  const map: Partial<Record<WorkflowState, WorkflowState>> = {
    [WorkflowState.RESEARCH_REVIEW]: WorkflowState.RESEARCHING,
    [WorkflowState.CONTENT_REVIEW]: WorkflowState.CONTENT_GENERATING,
    [WorkflowState.SEO_REVIEW]: WorkflowState.SEO_GENERATING,
    [WorkflowState.LANDING_REVIEW]: WorkflowState.LANDING_GENERATING,
  };
  return map[reviewState] ?? null;
}

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
    [WorkflowState.RESEARCH_REVIEW]: 'Research Review',
    [WorkflowState.CONTENT_GENERATING]: 'Content Generating',
    [WorkflowState.CONTENT_REVIEW]: 'Content Review',
    [WorkflowState.SEO_GENERATING]: 'SEO Generating',
    [WorkflowState.SEO_REVIEW]: 'SEO Review',
    [WorkflowState.LANDING_GENERATING]: 'Landing Page Generating',
    [WorkflowState.LANDING_REVIEW]: 'Landing Page Review',
    [WorkflowState.IMAGE_GENERATING]: 'Images Generating',
    [WorkflowState.SHOPIFY_DRAFT_CREATING]: 'Shopify Draft Creating',
    [WorkflowState.FINAL_REVIEW]: 'Final Review',
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
