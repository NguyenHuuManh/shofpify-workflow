/**
 * Purpose:
 * Server Action: Create a product from an idea and start its workflow.
 * Called when user submits the "New Workflow" form.
 *
 * Architecture: Server Action → ProductService → WorkflowService → Agent → Service
 */

'use server';

import { productService } from '@/services/product.service';
import { workflowService } from '@/services/workflow.service';
import { ResearchAgent } from '@/agents/research.agent';
import { redirect } from 'next/navigation';
import { createProductSchema } from '@/schemas/product.schema';
import { logger } from '@/lib/logger';

export async function startWorkflowFromIdea(formData: FormData): Promise<void> {
  const productIdea = formData.get('productIdea') as string;

  if (!productIdea || productIdea.trim().length === 0) {
    throw new Error('Product idea is required');
  }

  const parsed = createProductSchema.parse({ title: productIdea.trim() });

  // Step 1: Create the product
  const product = await productService.create(parsed);
  logger.info({ productId: product.id, title: product.title }, 'Product created from idea');

  // Step 2: Start the workflow
  const workflow = await workflowService.start({ productId: product.id });
  logger.info({ workflowId: workflow.id, productId: product.id }, 'Workflow started');

  // Step 3: Run ResearchAgent synchronously (always, not via BullMQ)
  try {
    logger.info({ workflowId: workflow.id }, 'Running ResearchAgent...');
    const agent = new ResearchAgent();
    const ctx = await agent.execute({
      workflowId: workflow.id,
      productId: product.id,
      productIdea: product.title,
    });

    if (ctx.researchRunId) {
      await workflowService.completeCurrentStep(workflow.id);
      logger.info({ workflowId: workflow.id }, 'ResearchAgent completed');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    logger.error({ workflowId: workflow.id, error: msg }, 'ResearchAgent failed');
    await workflowService.failCurrentStep(workflow.id, msg);
  }

  // Step 4: Redirect to workflow detail
  redirect(`/dashboard/workflows/${workflow.id}`);
}
