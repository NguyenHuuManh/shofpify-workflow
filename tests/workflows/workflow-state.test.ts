/**
 * Purpose:
 * Unit tests for WorkflowState machine.
 */

import { describe, it, expect } from 'vitest';
import {
  WorkflowState,
  isValidTransition,
  getNextStates,
  isTerminalState,
  getStateLabel,
  STATE_TRANSITIONS,
  STEP_TO_STATE,
  STATE_TO_STEP,
} from '@/workflows/workflow-state';

describe('WorkflowState', () => {
  describe('STATE_TRANSITIONS', () => {
    it('should define all required states', () => {
      const states = Object.values(WorkflowState);
      expect(states).toHaveLength(15);
      expect(states).toContain(WorkflowState.DRAFT);
      expect(states).toContain(WorkflowState.PUBLISHED);
    });

    it('should have valid transitions for all states', () => {
      for (const state of Object.values(WorkflowState)) {
        expect(STATE_TRANSITIONS[state]).toBeDefined();
        expect(Array.isArray(STATE_TRANSITIONS[state])).toBe(true);
      }
    });
  });

  describe('isValidTransition', () => {
    it('should allow DRAFT → RESEARCHING', () => {
      expect(isValidTransition(WorkflowState.DRAFT, WorkflowState.RESEARCHING)).toBe(true);
    });

    it('should allow RESEARCHING → RESEARCH_REVIEW', () => {
      expect(isValidTransition(WorkflowState.RESEARCHING, WorkflowState.RESEARCH_REVIEW)).toBe(true);
    });

    it('should allow RESEARCH_REVIEW → CONTENT_GENERATING', () => {
      expect(isValidTransition(WorkflowState.RESEARCH_REVIEW, WorkflowState.CONTENT_GENERATING)).toBe(true);
    });

    it('should allow RESEARCH_REVIEW → REJECTED', () => {
      expect(isValidTransition(WorkflowState.RESEARCH_REVIEW, WorkflowState.REJECTED)).toBe(true);
    });

    it('should allow RESEARCH_REVIEW → RESEARCHING for rework', () => {
      expect(isValidTransition(WorkflowState.RESEARCH_REVIEW, WorkflowState.RESEARCHING)).toBe(true);
    });

    it('should reject DRAFT → CONTENT_GENERATING (skip research)', () => {
      expect(isValidTransition(WorkflowState.DRAFT, WorkflowState.CONTENT_GENERATING)).toBe(false);
    });

    it('should reject PUBLISHED → anything (terminal)', () => {
      expect(isValidTransition(WorkflowState.PUBLISHED, WorkflowState.DRAFT)).toBe(false);
    });
  });

  describe('getNextStates', () => {
    it('should return RESEARCHING from DRAFT', () => {
      expect(getNextStates(WorkflowState.DRAFT)).toEqual([WorkflowState.RESEARCHING]);
    });

    it('should return next states from RESEARCH_REVIEW', () => {
      const next = getNextStates(WorkflowState.RESEARCH_REVIEW);
      expect(next).toContain(WorkflowState.CONTENT_GENERATING);
      expect(next).toContain(WorkflowState.RESEARCHING);
      expect(next).toContain(WorkflowState.REJECTED);
    });

    it('should return empty from PUBLISHED', () => {
      expect(getNextStates(WorkflowState.PUBLISHED)).toEqual([]);
    });
  });

  describe('isTerminalState', () => {
    it('should mark PUBLISHED as terminal', () => {
      expect(isTerminalState(WorkflowState.PUBLISHED)).toBe(true);
    });

    it('should not mark DRAFT as terminal', () => {
      expect(isTerminalState(WorkflowState.DRAFT)).toBe(false);
    });
  });

  describe('getStateLabel', () => {
    it('should return human-readable labels', () => {
      expect(getStateLabel(WorkflowState.RESEARCHING)).toBe('Researching');
      expect(getStateLabel(WorkflowState.CONTENT_GENERATING)).toBe('Content Generating');
      expect(getStateLabel(WorkflowState.PUBLISHED)).toBe('Published');
    });
  });

  describe('STEP_TO_STATE', () => {
    it('should map RESEARCH step to RESEARCHING state', () => {
      expect(STEP_TO_STATE.RESEARCH).toBe(WorkflowState.RESEARCHING);
    });

    it('should map PUBLISH step to PUBLISHED state', () => {
      expect(STEP_TO_STATE.PUBLISH).toBe(WorkflowState.PUBLISHED);
    });

    it('should have all workflow steps mapped', () => {
      expect(Object.keys(STEP_TO_STATE)).toHaveLength(13);
    });
  });

  describe('STATE_TO_STEP', () => {
    it('should map RESEARCHING state to RESEARCH step', () => {
      expect(STATE_TO_STEP[WorkflowState.RESEARCHING]).toBe('RESEARCH');
    });

    it('should map PUBLISHED to undefined (terminal state has no step)', () => {
      expect(STATE_TO_STEP[WorkflowState.PUBLISHED]).toBeUndefined();
    });
  });
});
