---
name: task-execution
description: "**PROJECT SKILL** — Enforces the Shopify Autonomous Store Platform task execution workflow. USE FOR: any code generation, modification, or feature implementation in this project. Ensures the agent reads all architecture documents, follows the layered architecture rules, respects the repository pattern, and produces production-ready code. INVOKES: read_file for document review, ask-questions for approval gates, file creation/editing tools for implementation. DO NOT USE FOR: general Q&A about the project without code changes, or work outside this workspace."
---

# Task Execution Workflow

## Role

You are the **lead engineer** of the **Shopify Autonomous Store Platform** — a Next.js Fullstack application that automates product research, content generation, and Shopify publishing through AI agents with human approval gates.

## Project Stack

| Category | Technology |
|---|---|
| Language | TypeScript (no JavaScript) |
| Framework | Next.js App Router (no Pages Router) |
| Database | PostgreSQL + Prisma ORM |
| Queue | Redis + BullMQ |
| Workflow | LangGraph |
| AI | Claude API (via abstracted Provider layer) |
| Integration | Shopify Admin API |
| Validation | Zod |
| Logging | Pino (structured JSON) |
| Testing | Vitest (80%+ coverage) |

## Required Reading (Every Session)

Before generating or modifying ANY code, read these documents in order:

1. `01-prd.md` — Product vision, scope, functional requirements
2. `02-sdd.md` — System architecture and core services
3. `03-ddd.md` — Database design, entities, relationships
4. `04-api-design.md` — API endpoints and routes
5. `05-engineering-standards.md` — Language, framework, folder, and layer rules
6. `06-deepseek.md` — Full architecture rules, constraints, forbidden patterns

Never generate code before understanding all documents.

---

## Architecture Rules (Mandatory)

### Layer Flow — Core Data

```
API Route → Service → Repository → Prisma → Database
```

Never violate this flow. Every data access goes through the Repository.

### Layer Flow — AI & External APIs

```
Agent → Service Layer → Provider Layer → External API
```

### Forbidden Patterns (Never)

- Agent → Prisma (direct database access)
- Agent → Shopify API (direct Shopify calls)
- Agent → Anthropic SDK (direct AI calls)
- Agent → Redis (direct cache/queue access)
- Controller → Prisma (bypass services)
- UI → External API (bypass backend)
- AI Aggregation → Fabricate product names, prices, URLs, suppliers, or costs
- Discovery Scoring → Include sourcing factors (supplier, sourcing, factoryCost, logistics) before 1688 enrichment

### Required Patterns (Always)

- Agent → Service Layer
- Service → Provider Layer
- Provider → External API
- Service → Repository → Prisma
- ProductAggregationService → AIProvider (for grouping only, no fabrication)
- CandidateScoringService → Phase 1 (Discovery, 6 factors) → Phase 2 (Full, 10 factors after sourcing)

### Shopify Integration

All Shopify operations MUST go through `src/services/shopify/`. Never call Shopify directly from agents, controllers, or UI.

### Repository Pattern

Repositories handle ONLY database reads and writes. They must NEVER contain business logic, API calls, or AI calls.

### Service Layer

Services handle business logic, workflow execution, validation coordination, and external integrations. Services must be reusable.

---

## Product Research Rules

### Query Intelligence (Phase -1 — before marketplace discovery)

Before marketplace and Apify candidate discovery, Product Research may collect
provider-backed query intelligence from `TREND`, `KEYWORD`, and approved
lightweight `SEARCH` evidence.

```
TREND / KEYWORD / SEARCH evidence
    ↓
QueryIntelligenceService.selectQueries()
    ↓
seed query + capped derived queries
    ↓
MARKETPLACE / Apify candidate discovery
```

Query intelligence rules:
- Derived queries must come from provider responses or normalized
  ResearchSource evidence
- The original seed query must always remain the first discovery query
- AI may rank, filter, deduplicate, or explain provider-backed query evidence
  only; it must not invent keywords
- Marketplace and Apify evidence created from query intelligence must preserve
  query provenance in `rawData`, including `queryUsed`, `querySource`,
  `queryScore`, and `collectionStage`
- Query intelligence must not create ProductCandidate records directly
- When no usable query intelligence exists, use the seed query only

### Product Aggregation (Phase 0 — before candidate creation)

Before individual candidates are created, marketplace listings from multiple
providers must be aggregated into unified product groups.

```
Raw provider listings / normalized ResearchSource evidence
    ↓
ProductAggregationService.aggregate() for MARKETPLACE evidence
    ↓
AIProvider.generateText() — group only, never fabricate
    ↓  (fallback: deterministic name dedup if AI unavailable)
ProductGroup[] (merged demand, price, rating, reviews, orders)
    ↓
buildCandidatesFromAggregatedGroups()
    ↓
Candidate Drafts
```

AI aggregation rules:
- Group items describing the same real-world product by: product name tokens,
  price cluster, review/order scale, provider context
- Never fabricate: product names, prices, URLs, suppliers, costs, evidence
- Assign every input listing to exactly one group
- Place uncertain matches in separate groups
- Fall back to deterministic name-based dedup when AI is unavailable
- Use SEARCH, TREND, KEYWORD, ADS_SIGNAL, and SOCIAL evidence only for scoring,
  risk, confidence, and source panels unless a later approved phase expands
  candidate seeding
- Exclude SOURCING evidence from initial discovery; it enriches an existing
  ProductCandidate through CandidateSourcingService

Merge rules per product group:
- demandSignal: maximum across all sources
- price: median (preserve min/max range)
- rating: arithmetic mean
- reviewCount, orderCount: sum across all sources
- sourceCount: used for confidence scoring

Persistence rules:
- Do not create a ProductGroup database model in this phase
- Store aggregation audit details in ProductCandidate.metadata and linked
  ResearchSource records
- Respect the configured candidate output limit
- Apify candidate discovery actors are configured in
  `config/apify-candidate-discovery.json`

### Two-Phase Candidate Scoring

Scoring must run in two distinct phases, never combining market signals with
unavailable sourcing data into a single score.

**Phase 1 — Discovery Scoring (during ResearchService.run()):**

Active factors (6):

| Factor | Weight (re-normalized) |
|---|---|
| demandScore | ~33% |
| trendScore | ~20% |
| marginScore | ~17% (only if landedCost/COGS available) |
| competitionScore | ~16% |
| creativePotentialScore | ~8% |
| riskScore | ~6% |

Excluded: supplierScore, sourcingScore, factoryCostScore, logisticsScore.

**Phase 2 — Full Scoring (after CandidateSourcingService.enrichCandidate()):**

All ten factors active with original weights. Runs after 1688 sourcing
enrichment completes. Replaces the candidate's winningScore and all factor
scores with sourcing-backed data.

**Margin constraint:**
- When price exists but COGS and landedCost are both unavailable, marginScore
  must fallback to 50 (not computed from price alone)
- Flag marginEstimated: true in candidate metadata
- Only use actual landedCost from 1688 for margin calculation in Phase 2

---

## Code Generation Order

Generate code in this exact order. Do not skip steps:

1. **Types** (`src/types/`) — Interfaces, type definitions
2. **Schemas** (`src/schemas/`) — Zod validation schemas
3. **Database Models** (`prisma/schema.prisma`) — Prisma schema + migrations
4. **Repositories** (`src/repositories/`) — Database access layer
5. **Services** (`src/services/`) — Business logic layer
6. **Providers** (`src/providers/`) — AI/External API abstraction
7. **Agents** (`src/agents/`) — AI agent implementations
8. **API Routes** (`src/app/api/`) — Route handlers
9. **UI Components** (`src/components/`) — React components

---

## Pre-Generation Checklist

Before generating any code, you MUST:

### 1. Explain Architecture Understanding

State which layers are involved, what data flows through them, and which existing files will be touched or created.

### 2. Identify Current Project Phase

Reference `07-task-execution.md` and the existing codebase. State which phase the work belongs to:

| Phase | Description |
|---|---|
| Phase 1 | Project Bootstrap |
| Phase 2 | Database Layer |
| Phase 3 | Service Layer |
| Phase 4 | Agent Framework |
| Phase 5 | Workflow Engine |
| Phase 6 | API Layer |
| Phase 7 | Dashboard |
| Phase 8 | Production Deployment |

### 3. Create Implementation Plan

List the files to create or modify, in code generation order. For each file, specify:
- Purpose
- Responsibilities
- Dependencies

### 4. Wait for Approval

**Do not generate large amounts of code without explicit user approval.** Present the plan and wait. For single-file changes or trivial fixes, proceed directly.

---

## Code Quality Requirements

### Every Generated File Must Include

```typescript
/**
 * Purpose:
 * [What this file does]
 *
 * Responsibilities:
 * - [Responsibility 1]
 * - [Responsibility 2]
 *
 * Dependencies:
 * - [Dependency 1]
 * - [Dependency 2]
 */
```

### Validation

All DTOs require Zod schemas in `src/schemas/`. Validation must happen BEFORE database writes, API calls, or workflow execution.

### Error Handling

Never throw raw `Error`. Always use `AppError`:

```typescript
{
  code: string;
  message: string;
  statusCode: number;
}
```

### Logging

Use Pino for structured JSON logs. Required fields: `timestamp`, `level`, `message`, `context`. Never use `console.log` in production code.

### Testing

- Framework: Vitest
- Minimum: 80% coverage
- Critical workflows require tests

### TypeScript Only

No JavaScript files. All code must be fully typed.

---

## Workflow State Machine

Workflows progress through these states in order. Never skip states:

```
DRAFT → RESEARCHING → RESEARCH_REVIEW
→ CONTENT_GENERATING → CONTENT_REVIEW
→ SEO_GENERATING → SEO_REVIEW
→ LANDING_GENERATING → LANDING_REVIEW
→ IMAGE_GENERATING → SHOPIFY_DRAFT_CREATING
→ FINAL_REVIEW → APPROVED → PUBLISHED
```

At any `*_REVIEW` state:
- **Approve** → proceed to the next generation step
- **Reject** → return to the generating step for rework (max 3 reworks per step)

All state changes must be persisted.

---

## Security Rules

- Never expose API keys, database credentials, or Shopify tokens
- Always use environment variables (see `.env.example`)
- Never hardcode secrets

---

## Performance Rules

- Prefer server-side data fetching
- Use pagination for list endpoints
- Add database indexes for query patterns
- Avoid N+1 queries and unbounded data loading

---

## UI Rules

- Use Server Components by default
- Use Client Components only when required (`'use client'`)
- Prefer Server Actions and Route Handlers over client-side state

---

## Summary Checklist

Before submitting any code change, verify:

- [ ] All architecture documents have been read
- [ ] No layer violations (Agent → Prisma, Agent → Shopify, etc.)
- [ ] Repository pattern is followed
- [ ] Zod schemas exist for all DTOs
- [ ] AppError used (no raw Error)
- [ ] Pino logging (no console.log)
- [ ] File header with Purpose/Responsibilities/Dependencies
- [ ] Tests written (if critical workflow)
- [ ] TypeScript only (no JS)
- [ ] Code generation order was followed
- [ ] Workflow states are not skipped
- [ ] Query Intelligence runs before marketplace discovery when enabled
- [ ] Derived queries are provider-backed and capped by validated config
- [ ] Query provenance is persisted in downstream ResearchSource rawData
- [ ] Product Aggregation runs before candidate creation (no per-listing candidates)
- [ ] AI aggregation never fabricates product data (names, prices, URLs, suppliers)
- [ ] Discovery scoring excludes sourcing factors (supplier, sourcing, factoryCost, logistics)
- [ ] Full scoring runs after CandidateSourcingService.enrichCandidate()
- [ ] marginScore never computed from price alone without COGS/landedCost
