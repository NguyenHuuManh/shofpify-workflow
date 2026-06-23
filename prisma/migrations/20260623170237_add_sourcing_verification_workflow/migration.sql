-- CreateEnum
CREATE TYPE "SourcingVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'NEEDS_MORE_INFO');

-- CreateTable
CREATE TABLE "SourcingVerification" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "SourcingVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "notes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "factoryExists" BOOLEAN NOT NULL DEFAULT false,
    "moqConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "priceReasonable" BOOLEAN NOT NULL DEFAULT false,
    "sampleAvailable" BOOLEAN NOT NULL DEFAULT false,
    "shippingFeasible" BOOLEAN NOT NULL DEFAULT false,
    "supplierResponsive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SourcingVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourcingVerification_candidateId_key" ON "SourcingVerification"("candidateId");

-- CreateIndex
CREATE INDEX "SourcingVerification_candidateId_idx" ON "SourcingVerification"("candidateId");

-- CreateIndex
CREATE INDEX "SourcingVerification_status_idx" ON "SourcingVerification"("status");

-- CreateIndex
CREATE INDEX "SourcingVerification_reviewerId_idx" ON "SourcingVerification"("reviewerId");

-- AddForeignKey
ALTER TABLE "SourcingVerification" ADD CONSTRAINT "SourcingVerification_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ProductCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingVerification" ADD CONSTRAINT "SourcingVerification_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
