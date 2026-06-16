-- CreateEnum
CREATE TYPE "ResearchProjectStatus" AS ENUM ('ACTIVE', 'SELECTED', 'PROMOTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ResearchProject" (
  "id" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "status" "ResearchProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "selectedCandidateId" TEXT,
  "promotedProductId" TEXT,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ResearchProject_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ResearchRun" ADD COLUMN "researchProjectId" TEXT;
ALTER TABLE "ResearchRun" ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProductCandidate" ADD COLUMN "researchProjectId" TEXT;
ALTER TABLE "ProductCandidate" ALTER COLUMN "productId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ResearchProject_status_idx" ON "ResearchProject"("status");
CREATE INDEX "ResearchProject_createdAt_idx" ON "ResearchProject"("createdAt");
CREATE INDEX "ResearchRun_researchProjectId_idx" ON "ResearchRun"("researchProjectId");
CREATE INDEX "ProductCandidate_researchProjectId_idx" ON "ProductCandidate"("researchProjectId");

-- AddForeignKey
ALTER TABLE "ResearchRun" ADD CONSTRAINT "ResearchRun_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductCandidate" ADD CONSTRAINT "ProductCandidate_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
