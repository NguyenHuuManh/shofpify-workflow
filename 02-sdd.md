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

Research Product Intelligence Module

---

## Backend

Route Handlers

Server Actions

BullMQ Workers

LangGraph

Research Providers

---

## Infrastructure

Nginx

Next.js

PostgreSQL

Redis

Worker

---

## Sequence

Create Product Research Project

↓

Research Service

↓

Research Agent

↓

Research Product Intelligence Module

↓

Product Candidate Ranking

↓

Select Candidate

↓

Promote Candidate to Product

↓

Workflow Service

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

Each production generation step (Content, SEO, Landing) has a dedicated dashboard page at:

```
/dashboard/workflows/:id/content
/dashboard/workflows/:id/seo
/dashboard/workflows/:id/landing
```

Each page provides:
- View generated content
- Edit any field inline before approving
- Approve → proceed to next step
- Reject with feedback → trigger re-generation

The dashboard also exposes a top-level Product Research menu at:

```
/dashboard/product-research
```

This page acts as an independent research workbench and provides:
- Active and completed research project visibility
- Product idea or niche search
- Candidate shortlist status and selected candidate summary when available
- Candidate promotion into a product creation workflow

---

## Review Gates

Each production generation step (Content, SEO, Landing) is followed by a review gate. Product Research uses candidate selection instead of a workflow review gate.

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

---

## Research Product Intelligence Module

Product Research is a dedicated module responsible for discovering, validating, scoring, and recommending product candidates before a product creation workflow begins.

The module follows the platform architecture:

```text
API Route / Server Action
    ↓
Research Service
    ↓
Research Repositories
    ↓
Prisma
    ↓
Database
```

Agent execution follows:

```text
Research Agent
    ↓
Research Service
    ↓
Research Provider Interfaces
    ↓
External Research APIs
```

The Research Agent must not call external research APIs, Prisma, Redis, Shopify APIs, or provider SDKs directly. Workflow execution should consume only a selected/promoted candidate snapshot and should not run Product Research as a mandatory workflow step.

---

## Research Data Sources

Research data must be collected through provider interfaces so providers can be replaced without changing business logic.

Initial provider categories:

- Search Provider: web results, competitor pages, review articles, discussion pages
- Marketplace Provider: listing price, reviews, ratings, sellers, common complaints, product variants
- Trend Provider: demand trend, seasonality, regional interest
- Keyword Provider: search volume, keyword difficulty, CPC estimates
- Ads Signal Provider: active ad examples, creative angles, saturation signals
- Supplier Provider: product cost, shipping cost, processing time, supplier reliability
- Social Listening Provider: customer pain points, objections, emotional language

Provider output must be normalized before persistence.

---

## Research Pipeline

The Research Product Intelligence Module runs the following pipeline:

```text
Input Product Idea / Niche
    ↓
Generate Candidate Hypotheses
    ↓
Collect External Evidence
    ↓
Normalize Evidence
    ↓
Estimate Cost and Profit
    ↓
Score Candidates
    ↓
Generate Risks and Recommendation
    ↓
Persist Research Run
    ↓
Candidate Selection
    ↓
Promote Candidate to Product Workflow
```

---

## Candidate Scoring

Each product candidate receives a score breakdown:

- Demand Score
- Trend Score
- Competition Score
- Margin Score
- Supplier Score
- Creative Potential Score
- Risk Score
- Winning Score

The Winning Score is a weighted aggregate. The scoring weights must be configurable in the service layer or settings.

---

## Product Research Workbench

The Product Research page must support:

- Ranked product candidate list
- Score breakdown per candidate
- Cost and margin analysis
- Source evidence panel
- Competitor and supplier summaries
- Risk flags
- Candidate selection action
- Candidate promotion action that creates Product and starts Workflow at Content

Starting the production workflow requires selecting a candidate. The selected candidate becomes the input context for Content generation.
