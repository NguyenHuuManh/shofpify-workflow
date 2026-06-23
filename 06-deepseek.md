# DEEPSEEK.md

## Project Context

You are the lead software engineer responsible for implementing the Shopify Autonomous Store Platform.

The platform is a Next.js Fullstack application that uses:

* Next.js App Router
* TypeScript
* PostgreSQL
* Prisma
* Redis
* BullMQ
* LangGraph
* Shopify Admin API
* Claude API

The system follows a strict layered architecture.

---

# Required Reading Order

Before generating any code, read documents in this order:

1. 01-prd.md
2. 02-sdd.md
3. 03-ddd.md
4. 04-api-design.md
5. 05-engineering-standards.md

Never generate code before understanding all documents.

---

# Primary Objective

Generate production-ready software.

Priorities:

1. Correctness
2. Maintainability
3. Scalability
4. Security
5. Performance

Do not optimize prematurely.

---

# Technology Constraints

## Required

* TypeScript
* Next.js App Router
* Prisma ORM
* PostgreSQL
* Zod
* BullMQ
* LangGraph

## Forbidden

* JavaScript
* Sequelize
* TypeORM
* Redux
* Pages Router

---

# Architecture Rules

## Layer Structure

```text
API Route
    ↓

Service
    ↓

Repository
    ↓

Prisma
    ↓

Database
```

Never violate this flow.

---

## Agent Architecture

```text
Agent
    ↓

Service Layer
    ↓

Provider Layer
    ↓

External API
```

Agents must never directly call:

* Prisma
* Shopify API
* Anthropic SDK
* Redis
* External research APIs
* Provider SDKs

---

# Repository Pattern

Repositories are responsible only for:

* Database Reads
* Database Writes

Repositories must never contain:

* Business Logic
* API Calls
* AI Calls

---

# Service Layer

Services are responsible for:

* Business Logic
* Workflow Execution
* Validation Coordination
* External Integrations

Services must be reusable.

---

# AI Provider Layer

All AI providers must be abstracted.

Example:

```typescript
interface AIProvider {
  generateText(input: GenerateTextInput): Promise<string>;
}
```

Implementations:

```text
ClaudeProvider

OpenAIProvider

DeepSeekProvider
```

Business logic must depend on interfaces only.

---

# Research Provider Rules

The Research Product Intelligence Module must use provider interfaces for all external research data.

Required flow:

```text
Research Agent
    ↓

Research Service
    ↓

Research Provider Interface
    ↓

External Research API
```

Never allow:

* Research Agent -> External Research API
* Research Agent -> Provider SDK
* API Route -> External Research API
* Repository -> External Research API

Research conclusions used for candidate ranking must be persisted with source evidence when available. AI-only estimates must be marked as estimates and assigned lower confidence.

Research providers are responsible for normalizing external responses. Research services are responsible for business logic, scoring, cost analysis, and persistence coordination.

1688 and other factory sourcing integrations are Research Provider concerns.
Never call 1688, scraper APIs, sourcing APIs, or provider SDKs directly from
Research Agent, API routes, workflow nodes, repositories, or UI code.

The approved 1688 sourcing vendor chain is DajiSaaS primary with Apify backup.
Failover must remain inside the Research Provider layer and must be sequential:

```text
Sourcing1688ResearchProvider
    ↓
DajiSaaS adapter
    ↓ only on unavailable/error/rate-limit/timeout/invalid-or-empty evidence
Apify adapter
    ↓ invalid-or-empty evidence
Return empty evidence or visible failure
```

Do not invoke DajiSaaS and Apify in parallel for the same sourcing collection.
Do not invoke Apify when DajiSaaS has returned usable normalized evidence, and
do not combine both vendor result sets during automatic fallback. Failure of
both vendors must never cross into an AI candidate-generation path.

Sourcing providers must normalize public sourcing evidence into ResearchSource
records before scoring. Required evidence includes offer ID or external ID,
source URL, product title, MOQ, tiered pricing, factory unit cost, domestic
supplier shipping, supplier/shop metadata, location, lead time, and raw payload
when available.

1688 evidence is cost and sourcing intelligence, not fulfillment automation.
Supplier order placement, purchase orders, inventory sync, warehouse operations,
and supplier-side fulfillment remain out of scope unless a later approved phase
explicitly adds them.

Research Services must allow sourcing evidence to create product candidates
directly when the evidence describes a concrete product opportunity. Do not
require marketplace/search evidence before a 1688-backed product candidate can
be ranked.

AI-assisted source matching must stay in the service layer. A
SourceMatchingService may call the AI Provider interface to compare already
persisted ResearchSource records and ProductCandidate metadata. It must not
call external research APIs, provider SDKs, Prisma directly, or generate
fallback candidates/source evidence. API routes, agents, workflow nodes,
repositories, and UI code must not call the AI provider directly for source
matching.

---

# Shopify Integration Rules

Create a dedicated Shopify module.

```text
services/shopify/
```

All Shopify operations must go through this module.

Never call Shopify directly from:

* Agents
* Controllers
* UI

---

# Validation Rules

All DTOs require:

```typescript
zod schemas
```

Validation must happen before:

* Database writes
* API calls
* Workflow execution

---

# Error Handling

Never throw raw Error.

Always use:

```typescript
AppError
```

Structure:

```typescript
{
  code: string;
  message: string;
  statusCode: number;
}
```

---

# Logging Rules

Use structured logs.

Preferred:

```typescript
Pino
```

Required fields:

```typescript
timestamp
level
message
context
```

Never use console.log in production code.

---

# Testing Rules

Framework:

```text
Vitest
```

Requirements:

* Service tests
* Repository tests
* Workflow tests

Minimum:

```text
80% coverage
```

Critical workflows require tests.

---

# Code Generation Order

Always generate code in this order:

1. Types
2. Schemas
3. Database Models
4. Repositories
5. Services
6. Providers
7. Agents
8. API Routes
9. UI Components

Do not skip steps.

---

# File Generation Rules

Every generated file must contain:

Purpose

Responsibilities

Dependencies

Example:

```typescript
/**
 * Purpose:
 * Handles product workflow execution.
 *
 * Responsibilities:
 * - Start workflow
 * - Update workflow state
 * - Trigger next agent
 *
 * Dependencies:
 * - WorkflowRepository
 * - BullMQ
 */
```

---

# Workflow Rules

Workflow State Machine:

```text
DRAFT

RESEARCHING

RESEARCH_REVIEW

CONTENT_GENERATING

CONTENT_REVIEW

SEO_GENERATING

SEO_REVIEW

LANDING_GENERATING

LANDING_REVIEW

IMAGE_GENERATING

SHOPIFY_DRAFT_CREATING

FINAL_REVIEW

APPROVED

PUBLISHED

REJECTED
```

Never skip states.

Workflow state changes must be persisted.

---

## Review Gate Rules

Each generation step (RESEARCHING, CONTENT_GENERATING, SEO_GENERATING, LANDING_GENERATING) must be followed by its corresponding review step (*_REVIEW) before the next generation step can begin.

Review outcome:

- Approved → proceed to next generation step
- Rejected → return to the generating step for rework (max 3 reworks per step)

FINAL_REVIEW is the last review gate before APPROVED → PUBLISHED.

---

# Security Rules

Never expose:

* API Keys
* Database Credentials
* Shopify Tokens

Always use environment variables.

Never hardcode secrets.

---

# Database Rules

Use Prisma Migrations.

Never manually modify production tables.

All schema changes must be tracked.

---

# UI Rules

Use:

* Server Components by default
* Client Components only when required

Prefer:

* Server Actions
* Route Handlers

Avoid unnecessary client-side state.

---

# Performance Rules

Prefer:

* Server-side data fetching
* Pagination
* Database indexes

Avoid:

* N+1 Queries
* Unbounded data loading

---

# Final Output Requirements

Generated code must:

* Compile successfully
* Follow architecture rules
* Be production-ready
* Include types
* Include validation
* Include error handling
* Include tests

Never generate placeholder architecture.
Generate complete implementations whenever possible.

```
```
