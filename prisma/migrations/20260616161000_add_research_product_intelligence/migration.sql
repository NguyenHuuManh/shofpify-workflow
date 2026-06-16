-- CreateEnum
CREATE TYPE "ResearchSourceType" AS ENUM (
  'SEARCH',
  'MARKETPLACE',
  'TREND',
  'KEYWORD',
  'ADS_SIGNAL',
  'SUPPLIER',
  'SOCIAL',
  'AI_ESTIMATE'
);

-- CreateEnum
CREATE TYPE "ResearchCandidateStatus" AS ENUM (
  'DISCOVERED',
  'SHORTLISTED',
  'APPROVED',
  'REJECTED'
);

-- AlterTable
ALTER TABLE "ProductResearch" ADD COLUMN "selectedCandidateId" TEXT;

-- CreateTable
CREATE TABLE "ResearchRun" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "workflowId" TEXT,
  "input" JSONB NOT NULL,
  "summary" TEXT,
  "recommendation" JSONB,
  "providerCosts" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCandidate" (
  "id" TEXT NOT NULL,
  "researchRunId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "positioning" TEXT NOT NULL,
  "targetMarket" TEXT,
  "sellingAngle" TEXT,
  "recommendedPrice" DECIMAL(10,2),
  "estimatedCOGS" DECIMAL(10,2),
  "estimatedShipping" DECIMAL(10,2),
  "estimatedGrossProfit" DECIMAL(10,2),
  "grossMarginPercent" DECIMAL(5,2),
  "breakEvenRoas" DECIMAL(6,2),
  "demandScore" INTEGER,
  "trendScore" INTEGER,
  "competitionScore" INTEGER,
  "marginScore" INTEGER,
  "supplierScore" INTEGER,
  "creativePotentialScore" INTEGER,
  "riskScore" INTEGER,
  "winningScore" INTEGER,
  "confidence" TEXT,
  "status" "ResearchCandidateStatus" NOT NULL DEFAULT 'DISCOVERED',
  "risks" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSource" (
  "id" TEXT NOT NULL,
  "researchRunId" TEXT NOT NULL,
  "candidateId" TEXT,
  "type" "ResearchSourceType" NOT NULL,
  "provider" TEXT NOT NULL,
  "url" TEXT,
  "externalId" TEXT,
  "title" TEXT,
  "extractedSignal" TEXT NOT NULL,
  "rawData" JSONB,
  "confidence" DOUBLE PRECISION,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ResearchSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchRun_productId_idx" ON "ResearchRun"("productId");
CREATE INDEX "ResearchRun_workflowId_idx" ON "ResearchRun"("workflowId");
CREATE INDEX "ResearchRun_createdAt_idx" ON "ResearchRun"("createdAt");
CREATE INDEX "ProductCandidate_researchRunId_idx" ON "ProductCandidate"("researchRunId");
CREATE INDEX "ProductCandidate_productId_idx" ON "ProductCandidate"("productId");
CREATE INDEX "ProductCandidate_status_idx" ON "ProductCandidate"("status");
CREATE INDEX "ProductCandidate_winningScore_idx" ON "ProductCandidate"("winningScore");
CREATE INDEX "ResearchSource_researchRunId_idx" ON "ResearchSource"("researchRunId");
CREATE INDEX "ResearchSource_candidateId_idx" ON "ResearchSource"("candidateId");
CREATE INDEX "ResearchSource_type_idx" ON "ResearchSource"("type");

-- AddForeignKey
ALTER TABLE "ResearchRun" ADD CONSTRAINT "ResearchRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductCandidate" ADD CONSTRAINT "ProductCandidate_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductCandidate" ADD CONSTRAINT "ProductCandidate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchSource" ADD CONSTRAINT "ResearchSource_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchSource" ADD CONSTRAINT "ResearchSource_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ProductCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
