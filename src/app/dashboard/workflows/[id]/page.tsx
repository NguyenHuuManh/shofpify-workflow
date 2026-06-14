/**
 * Purpose:
 * Workflow detail page — shows full workflow progress, steps, and actions.
 * Server Component.
 */

import { Card, Badge, Button } from '@/components/ui';
import { workflowService } from '@/services/workflow.service';
import { notFound } from 'next/navigation';
import type { StepStatus } from '@prisma/client';

const stepStatusVariant: Record<StepStatus, 'info' | 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  RUNNING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
};

interface Props {
  params: { id: string };
}

export default async function WorkflowDetailPage({ params }: Props): Promise<React.ReactElement> {
  let workflow;
  try {
    workflow = await workflowService.getById(params.id);
  } catch {
    notFound();
  }

  const steps = await workflowService.getSteps(params.id);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <a
          href="/dashboard/workflows"
          style={{ color: '#64748b', fontSize: '13px', textDecoration: 'none' }}
        >
          ← Back to Workflows
        </a>
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 700,
            margin: '8px 0 4px',
            color: '#0f172a',
          }}
        >
          Workflow {workflow.id}
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Badge
            variant={
              workflow.status === 'COMPLETED'
                ? 'success'
                : workflow.status === 'FAILED'
                  ? 'danger'
                  : 'info'
            }
          >
            {workflow.status}
          </Badge>
          <span style={{ color: '#94a3b8', fontSize: '13px' }}>
            Started {new Date(workflow.startedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Progress Steps */}
      <Card style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 20px', color: '#0f172a' }}>
          Pipeline Progress
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {steps.map((step, i) => (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: step.status === 'RUNNING' ? '#eff6ff' : step.status === 'COMPLETED' ? '#f0fdf4' : step.status === 'FAILED' ? '#fef2f2' : '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              {/* Step number */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '13px',
                  background:
                    step.status === 'COMPLETED'
                      ? '#22c55e'
                      : step.status === 'RUNNING'
                        ? '#3b82f6'
                        : step.status === 'FAILED'
                          ? '#ef4444'
                          : '#e2e8f0',
                  color: step.status === 'PENDING' ? '#94a3b8' : '#fff',
                }}
              >
                {step.status === 'COMPLETED' ? '✓' : step.status === 'FAILED' ? '✗' : i + 1}
              </div>

              {/* Step info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>
                  {step.step.replace(/_/g, ' ')}
                </div>
                {step.errorMessage && (
                  <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '2px' }}>
                    {step.errorMessage}
                  </div>
                )}
              </div>

              {/* Status + time */}
              <div style={{ textAlign: 'right' }}>
                <Badge variant={stepStatusVariant[step.status]}>
                  {step.status}
                </Badge>
                {step.completedAt && (
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    {new Date(step.completedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Actions */}
      {workflow.status === 'RUNNING' && workflow.currentStep === 'REVIEW' && (
        <Card>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px', color: '#0f172a' }}>
            Review Actions
          </h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="primary">Approve</Button>
            <Button variant="danger">Reject</Button>
            <Button variant="secondary">Request Changes</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
