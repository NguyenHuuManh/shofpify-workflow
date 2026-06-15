-- AlterEnum
-- Adds intermediate review gate types to WorkflowStepType
ALTER TYPE "WorkflowStepType" ADD VALUE 'RESEARCH_REVIEW';
ALTER TYPE "WorkflowStepType" ADD VALUE 'CONTENT_REVIEW';
ALTER TYPE "WorkflowStepType" ADD VALUE 'SEO_REVIEW';
ALTER TYPE "WorkflowStepType" ADD VALUE 'LANDING_REVIEW';
ALTER TYPE "WorkflowStepType" ADD VALUE 'FINAL_REVIEW';
