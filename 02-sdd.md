# SYSTEM DESIGN DOCUMENT

## Architecture

Next.js Fullstack

---

## Core Services

Frontend

Dashboard

Review Center (per-section: Research, Content, SEO, Landing)

Agent Monitoring

Workflow Manager

---

## Backend

Route Handlers

Server Actions

BullMQ Workers

LangGraph

---

## Infrastructure

Nginx

Next.js

PostgreSQL

Redis

Worker

---

## Sequence

Create Product

↓

Workflow Service

↓

Research Agent

↓

Research Review + Edit

↓

Content Agent

↓

Content Review + Edit

↓

SEO Agent

↓

SEO Review + Edit

↓

Landing Agent

↓

Landing Review + Edit

↓

Shopify Agent

↓

Final Review

↓

Approval

↓

Publish

---

## Per-Section Review & Edit Pages

Each generation step (Research, Content, SEO, Landing) has a dedicated dashboard page at:

```
/dashboard/workflows/:id/research
/dashboard/workflows/:id/content
/dashboard/workflows/:id/seo
/dashboard/workflows/:id/landing
```

Each page provides:
- View generated content
- Edit any field inline before approving
- Approve → proceed to next step
- Reject with feedback → trigger re-generation

---

## Review Gates

Each generation step (Research, Content, SEO, Landing) is followed by a review gate.

Approve → proceed to next step.

Reject → return to the generating step for rework (max 3 reworks per step).

---

## Retry Strategy

Agent Failure:

Retry 3 times

Exponential Backoff

5s

15s

45s

---

## Queue Strategy

research-queue

content-queue

seo-queue

landing-queue

publish-queue

---

## Event Driven

workflow.created

research.completed

content.completed

seo.completed

review.approved

product.published

```
```
