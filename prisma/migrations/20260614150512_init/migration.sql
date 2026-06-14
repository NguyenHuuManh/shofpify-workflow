-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'REVIEWER', 'EDITOR');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('PENDING', 'RUNNING', 'FAILED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkflowStepType" AS ENUM ('RESEARCH', 'CONTENT', 'SEO', 'LANDING', 'IMAGE', 'SHOPIFY', 'REVIEW', 'PUBLISH');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'RUNNING', 'FAILED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('HERO_IMAGE', 'PRODUCT_IMAGE', 'THUMBNAIL', 'AD_CREATIVE', 'LANDING_IMAGE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "workflowId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductResearch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "targetAudience" JSONB NOT NULL,
    "competitors" JSONB NOT NULL,
    "painPoints" JSONB NOT NULL,
    "usp" JSONB NOT NULL,
    "marketSummary" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductResearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductContent" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "subHeadline" TEXT,
    "description" TEXT NOT NULL,
    "benefits" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "faq" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSEO" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "metaTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSEO_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyResource" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopifyProductId" TEXT,
    "shopifyCollectionId" TEXT,
    "shopifyPageId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "ShopifyResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "currentStep" "WorkflowStepType" NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "step" "WorkflowStepType" NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "input" JSONB NOT NULL,
    "output" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "workflowId" TEXT,
    "agentRunId" TEXT,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProductResearch_productId_key" ON "ProductResearch"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductContent_productId_key" ON "ProductContent"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSEO_productId_key" ON "ProductSEO"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSEO_slug_key" ON "ProductSEO"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_productId_key" ON "LandingPage"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyResource_productId_key" ON "ShopifyResource"("productId");

-- CreateIndex
CREATE INDEX "ShopifyResource_published_idx" ON "ShopifyResource"("published");

-- CreateIndex
CREATE INDEX "Workflow_status_idx" ON "Workflow"("status");

-- CreateIndex
CREATE INDEX "Workflow_currentStep_idx" ON "Workflow"("currentStep");

-- CreateIndex
CREATE INDEX "WorkflowStep_workflowId_idx" ON "WorkflowStep"("workflowId");

-- CreateIndex
CREATE INDEX "Approval_workflowId_idx" ON "Approval"("workflowId");

-- CreateIndex
CREATE INDEX "AgentRun_workflowId_idx" ON "AgentRun"("workflowId");

-- CreateIndex
CREATE INDEX "AIUsageLog_createdAt_idx" ON "AIUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "AIUsageLog_workflowId_idx" ON "AIUsageLog"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductResearch" ADD CONSTRAINT "ProductResearch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductContent" ADD CONSTRAINT "ProductContent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSEO" ADD CONSTRAINT "ProductSEO_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyResource" ADD CONSTRAINT "ShopifyResource_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
