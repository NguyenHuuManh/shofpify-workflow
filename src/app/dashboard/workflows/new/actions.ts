/**
 * Purpose:
 * Server Action: Create a product from an idea and start its workflow.
 * Called when user submits the "New Workflow" form.
 *
 * Architecture: Server Action → ProductService → WorkflowService
 */

'use server';

import { productService } from '@/services/product.service';
import { workflowService } from '@/services/workflow.service';
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

  redirect(`/dashboard/workflows/${workflow.id}`);
}
