-- Add first-class sourcing evidence and candidate cost fields for 1688-backed research.

ALTER TYPE "ResearchSourceType" ADD VALUE IF NOT EXISTS 'SOURCING';

ALTER TABLE "ProductCandidate"
  ADD COLUMN "factoryUnitCost" DECIMAL(10, 2),
  ADD COLUMN "moq" INTEGER,
  ADD COLUMN "landedCost" DECIMAL(10, 2),
  ADD COLUMN "landedCostBreakdown" JSONB,
  ADD COLUMN "sourcingScore" INTEGER,
  ADD COLUMN "factoryCostScore" INTEGER,
  ADD COLUMN "logisticsScore" INTEGER;
