-- DropForeignKey
ALTER TABLE "ProductCandidate" DROP CONSTRAINT "ProductCandidate_productId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchRun" DROP CONSTRAINT "ResearchRun_productId_fkey";

-- AddForeignKey
ALTER TABLE "ResearchRun" ADD CONSTRAINT "ResearchRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCandidate" ADD CONSTRAINT "ProductCandidate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
