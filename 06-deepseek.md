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

Research Services must not allow sourcing evidence to create initial product
candidates directly. Sourcing evidence is candidate-level enrichment after a
marketplace-backed candidate exists. Initial discovery must not require 1688
evidence and must not call sourcing providers by default.

Research Services may run provider-backed query intelligence before marketplace
candidate discovery. This phase must call only approved Research Provider
interfaces for `TREND`, `KEYWORD`, and lightweight `SEARCH` evidence. A
QueryIntelligenceService may extract, rank, deduplicate, and cap derived
queries from provider responses, but it must not call external APIs directly,
persist ProductCandidate records, or invent query text. AI may be used only to
rank/filter/explain provider-backed query candidates; it must not generate
new keywords that are absent from provider evidence.

The discovery orchestration should be sequential by stage and parallel inside a
stage:

```text
Query Intelligence Providers
    ↓
QueryIntelligenceService
    ↓
DataForSEO Merchant / Marketplace / Apify candidate discovery using seed query + derived queries
    ↓
ProductAggregationService
    ↓
Candidate enrichment providers
```

Every ResearchSource created from a derived query should include query
provenance in rawData, including `queryUsed`, `querySource`, `queryScore`, and
`collectionStage`.

AI-assisted source matching must stay in the service layer. A
SourceMatchingService may call the AI Provider interface to compare already
persisted ResearchSource records and ProductCandidate metadata. It must not
call external research APIs, provider SDKs, Prisma directly, or generate
fallback candidates/source evidence. API routes, agents, workflow nodes,
repositories, and UI code must not call the AI provider directly for source
matching.

Autonomous discovery jobs must stay in the service and jobs layers. API routes
and dashboard actions may create/enqueue a discovery job only. The job service
may call the AI Provider interface to generate a query plan, then must call
ResearchService to collect provider-backed evidence. AI planner output must
never be persisted as ProductCandidate, ResearchSource, supplier URL, cost,
MOQ, landed cost, or marketplace evidence.

---

# Product Aggregation Constraints

Product candidate discovery is a two-phase pipeline. It must first collect raw
provider listings, then aggregate multi-source marketplace listings before
creating individual candidates.

```text
Raw Provider Listings / Normalized ResearchSource Evidence
    ↓
ProductAggregationService (MARKETPLACE evidence)
    ↓
AIProvider.generateText (grouping only, no fabrication)
    ↓
ProductGroup[] (merged metrics)
    ↓
buildCandidatesFromAggregatedGroups()
    ↓
Candidate Drafts
```

DataForSEO Merchant Google Shopping is the preferred marketplace validation
provider for product-like discovery queries. It must run only inside the
Research Provider layer and normalize Google Shopping product results into
`MARKETPLACE` ResearchSource evidence. Required normalized evidence includes
product title, product URL or product ID, price, currency, seller/shop signal,
rating, review or vote count when available, and query provenance. Merchant
validation does not replace ProductAggregationService; multiple Merchant
listings can describe the same product opportunity and must be grouped before
candidate creation.

Apify marketplace actors remain available as fallback or additional
marketplace evidence when DataForSEO Merchant is unavailable, unconfigured,
fails, or returns no usable listings. Provider orchestration must avoid
fabricating product candidates when both Merchant and fallback marketplace
providers return no usable evidence.

AI aggregation must only group provider-backed evidence. It must not generate
product names, prices, URLs, suppliers, costs, or source evidence. Every input
listing must be assigned to exactly one group. Uncertain matches go in separate
groups.

Fallback: when AI is unavailable, the aggregation must use deterministic
name-based deduplication as the fallback path.

Only `MARKETPLACE` evidence seeds initial ProductCandidate drafts. `SEARCH`,
`TREND`, `KEYWORD`, `ADS_SIGNAL`, and `SOCIAL` evidence can enrich scoring and
confidence. `SOURCING` evidence is excluded from initial discovery and can only
update an existing candidate through CandidateSourcingService.

Do not add a ProductGroup database model for this phase. Product groups are
transient service-layer outputs and must be persisted only through candidate
metadata and linked ResearchSource records unless a later approved migration
adds first-class aggregation review/reporting.

Apify candidate discovery actors are configured in
`config/apify-candidate-discovery.json`. The Apify candidate discovery provider
must run only configured actors whose provider type is enabled by the research
configuration and must normalize dataset items into ResearchSource evidence
instead of directly creating candidates.

When QueryIntelligenceService selects derived queries, the Apify candidate
discovery provider may run the same configured actors for each allowed query up
to the validated query cap. It must preserve the actor ID and query provenance
on normalized source rawData and must not synthesize missing marketplace
listings when an actor returns no evidence.

---

# Two-Phase Scoring Constraints

Candidate scoring must run in two phases, never combining market signals with
unavailable sourcing data into a single score.

Phase 1 (Discovery) — during ResearchService.run():

- Active factors: demand, trend, competition, creativePotential, risk
- marginScore only when landedCost or COGS data exists
- Excluded factors: supplier, sourcing, factoryCost, logistics
- Weights re-normalized for active factors only

Phase 2 (Full) — after CandidateSourcingService.enrichCandidate():

- All ten factors active
- Sourcing-dependent factors backed by real 1688 evidence
- Replaces candidate winningScore and all factor scores

Margin constraint: never compute marginScore from price without cost data.
When COGS and landedCost are both unavailable, marginScore must fallback to 50
with metadata flag marginEstimated: true.

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
