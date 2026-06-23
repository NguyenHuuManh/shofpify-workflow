-- CreateEnum
CREATE TYPE "ResearchDiscoveryJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ResearchDiscoveryJob" (
    "id" TEXT NOT NULL,
    "researchProjectId" TEXT NOT NULL,
    "status" "ResearchDiscoveryJobStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL,
    "queryPlan" JSONB,
    "result" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchDiscoveryJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchDiscoveryJob_researchProjectId_idx" ON "ResearchDiscoveryJob"("researchProjectId");

-- CreateIndex
CREATE INDEX "ResearchDiscoveryJob_status_idx" ON "ResearchDiscoveryJob"("status");

-- CreateIndex
CREATE INDEX "ResearchDiscoveryJob_createdAt_idx" ON "ResearchDiscoveryJob"("createdAt");

-- AddForeignKey
ALTER TABLE "ResearchDiscoveryJob" ADD CONSTRAINT "ResearchDiscoveryJob_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
