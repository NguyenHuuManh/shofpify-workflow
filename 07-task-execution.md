# TASK EXECUTION PLAN

## Phase 1

Project Bootstrap

Tasks:
- Create Next.js application
- Configure TypeScript
- Configure ESLint
- Configure Prettier
- Configure Prisma
- Configure PostgreSQL
- Configure Redis

Deliverables:
- Running application
- Database connection
- Redis connection

---

## Phase 2

Database Layer

Tasks:
- Prisma schema
- WorkflowStepType enum (14 types: RESEARCH, RESEARCH_REVIEW, CONTENT, CONTENT_REVIEW, SEO, SEO_REVIEW, LANDING, LANDING_REVIEW, IMAGE, SHOPIFY, FINAL_REVIEW, PUBLISH)
- Migrations
- Repositories

Deliverables:
- Repository layer complete

---

## Phase 2b

Authentication

Tasks:
- Add `passwordHash` field to User model + migration
- Create auth types (`LoginInput`, `RegisterInput`, `AuthSession`, `JwtPayload`)
- Create Zod schemas (`loginSchema`, `registerSchema`)
- Create `src/lib/auth.ts` — JWT sign/verify + bcrypt password hashing
- Extend `UserRepository` with `findByEmail()`, `createWithPassword()`, `updatePassword()`
- Create `AuthService` — login, register, getSession, verifyToken
- Create API routes: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`, `GET /api/auth/me`
- Create `src/middleware.ts` — protect `/dashboard/*` and `/api/*` (except `/api/auth/*`)
- Create login page at `/login` with login form
- Create client-side `AuthProvider` context for session state
- Update seed script with hashed admin password

Deliverables:
- Users must authenticate before accessing dashboard or API
- JWT-based sessions with httpOnly cookies
- Role-based access control enforced at API layer

---

## Phase 3

Service Layer

Tasks:
- Product Service
- Workflow Service
- Review Service (per-step approvals: research, content, seo, landing, final)
- Shopify Service

Deliverables:
- Service layer complete

---

## Phase 4

Agent Framework

Tasks:
- Research Agent
- Content Agent
- SEO Agent
- Landing Agent
- Review Agent
- Intermediate Review Gates (Research Review, Content Review, SEO Review, Landing Review)

Deliverables:
- Agent layer complete
- Per-step review workflow

---

## Phase 5

Workflow Engine

Tasks:
- LangGraph
- BullMQ
- State Machine (with intermediate review gates + rework loops, max 3 reworks/step)

Deliverables:
- Workflow execution with per-step review gates

---

## Phase 6

API Layer

Tasks:
- REST API
- Per-step review endpoints (POST /workflow/:id/review/research, /content, /seo, /landing, /final)
- Validation
- Error Handling

Deliverables:
- Public API

---

## Phase 6b

API Layer — Per-Step Content Routes

Tasks:
- GET /workflow/:id/research — fetch research data
- PUT /workflow/:id/research — edit research data
- GET /workflow/:id/content — fetch content data
- PUT /workflow/:id/content — edit content data
- GET /workflow/:id/seo — fetch SEO data
- PUT /workflow/:id/seo — edit SEO data
- GET /workflow/:id/landing — fetch landing page data
- PUT /workflow/:id/landing — edit landing page data
- Add Zod schemas for each edit payload (updateResearchSchema, updateContentSchema, updateSeoSchema, updateLandingSchema)
- Add update methods to ProductService (updateResearch, updateContent, updateSEO, updateLanding)

Deliverables:
- Per-section GET + PUT API routes
- Content editing capabilities via API

---

## Phase 7

Dashboard

Tasks:
- Workflow Dashboard (with per-step progress)
- Review Dashboard (step-by-step review interface)
- Monitoring Dashboard

Deliverables:
- Working UI

---

## Phase 7b

Dashboard — Per-Step Review & Edit Pages

Tasks:
- /dashboard/workflows/:id/research — Research review + edit page
- /dashboard/workflows/:id/content — Content review + edit page
- /dashboard/workflows/:id/seo — SEO review + edit page
- /dashboard/workflows/:id/landing — Landing review + edit page
- Each page: view generated content, inline edit, approve/reject buttons
- Update workflow detail page with navigation links to each section

Deliverables:
- Dedicated review + edit dashboard per section
- Human can edit AI-generated content before approving

---

## Phase 7c

Research Product Intelligence Module

Tasks:
- Add Research Product V2 types for research runs, source evidence, candidates, scoring, risks, and recommendations
- Add Zod schemas for research run configuration, candidate selection, candidate score payloads, and normalized source evidence
- Add Prisma models and migrations for ResearchRun, ProductCandidate, ResearchSource, ResearchSourceType, and ResearchCandidateStatus
- Add repositories for research runs, product candidates, and research sources
- Add ResearchService to coordinate candidate discovery, source persistence, cost analysis, scoring, recommendation, and selected candidate state
- Add CandidateScoringService with configurable scoring weights
- Add provider interfaces for Search, Marketplace, Trend, Keyword, Ads Signal, Supplier, and Social Listening data
- Add initial provider implementations or stubs behind feature flags and environment configuration
- Upgrade ResearchAgent to call ResearchService and AIProvider without directly accessing repositories, external APIs, provider SDKs, Prisma, Redis, or Shopify
- Refactor workflow entrypoints so Research execution is orchestrated through WorkflowService or WorkflowEngine, not duplicated in API routes or server actions
- Add API routes for research runs, ranked candidates, candidate detail, candidate selection, and source evidence
- Add top-level /dashboard/product-research menu page for research-focused workflow navigation
- Add structured product brief controls for target market, objective, price band,
  margin target, max MOQ, landed-cost assumptions, risk tolerance, and excluded
  categories
- Add top-candidate comparison snapshot with score, economics, sourcing, and
  evidence quality
- Decouple Product Research from Workflow so research projects can exist before a Product or Workflow
- Add candidate promotion flow that creates Product and starts Workflow at Content
- Upgrade /dashboard/workflows/:id/research into a candidate review page with ranked list, score breakdown, evidence panel, cost analysis, risk flags, approve selected candidate, and reject with feedback
- Add tests for ResearchService, CandidateScoringService, repositories, API routes, ResearchAgent, and workflow transition behavior

Deliverables:
- Product Research produces a ranked, source-backed product candidate shortlist outside Workflow
- Reviewers can select and promote one candidate before Content generation starts
- Content generation receives selected candidate context
- Candidate scores, source evidence, costs, risks, and recommendations are persisted and auditable

### Phase 7c Supplemental Provider Upgrade

Supplemental data providers must replace the previous local-only stub behavior
for Search, Marketplace, Trend, Keyword, Ads Signal, and Supplier/Sourcing
evidence.

Implementation requirements:
- Add optional provider credentials in `.env.example` and validated env loading
- Keep all external calls inside `src/providers/research/`
- Return empty evidence with structured warning logs when credentials are missing
- Persist every normalized external signal as ResearchSource
- Use provider-backed metrics to adjust candidate scores and confidence
- Do not fall back to AI-generated product candidates when providers are
  missing, failing, or returning no evidence; return an empty shortlist or
  visible failure state instead
- Add focused provider and ResearchService tests

DataForSEO should be treated as the primary supplemental provider when
`DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` are configured. SerpAPI and Brave
Search remain optional fallbacks for search, marketplace, and trend evidence.

---

### Phase 7d 1688 Sourcing Intelligence Upgrade

The Product Research module must support the user's factory sourcing model:
research product opportunities, discover factory supply sources, estimate
production and landed cost, rank products by profit potential, then let a human
decide whether to contact/order from the discovered factory. This is not a
dropshipping model.

Primary source:
- 1688 is the target source for factory cost and supplier discovery evidence.
- DajiSaaS is the selected primary 1688 API provider.
- Apify is the selected sequential backup provider and must be called only when
  DajiSaaS is unavailable, fails, times out, is rate-limited, fails validation,
  or returns no usable evidence.
- DajiSaaS and Apify must not be called in parallel or merged during automatic
  failover. If both return no usable evidence, Product Research must return an
  empty shortlist or visible failure without AI-generated fallback candidates.
- The provider must be replaceable behind the Research Provider interface.

Tasks:
- [x] Add sourcing-specific types for 1688 offers, tiered prices, MOQ, landed cost
  breakdown, sourcing score, factory cost score, logistics score, and sourcing
  risk.
- [x] Add Zod schemas for sourcing configuration, landed cost assumptions, and
  normalized `SOURCING` evidence.
- [x] Add Prisma migration for `SOURCING` ResearchSourceType and first-class
  ProductCandidate sourcing fields.
- [x] Add a `Sourcing1688ResearchProvider` under `src/providers/research/`.
- [x] Add provider credentials in `.env.example` and `src/lib/env.ts` using explicit
  names such as `SOURCING_1688_PROVIDER`, `SOURCING_1688_API_KEY`, and
  `SOURCING_1688_ENDPOINT`. Do not continue expanding generic
  `SUPPLIER_PROVIDER_*` names for 1688-specific behavior.
- [x] Add the original `SOURCING` evidence path and candidate cost fields.
  This foundation is retained, but the current Product Research flow no longer
  calls 1688 during initial candidate discovery.
- [x] Update cost analysis to calculate landed cost from factory unit cost, MOQ,
  tiered prices, domestic China shipping, international freight assumptions,
  agent fee, packaging/QC, customs/duty, and payment fees.
- [x] Update `CandidateScoringService` to include sourcing, factory cost, logistics,
  margin, and sourcing risk signals.
- [x] Update Product Research APIs and dashboard candidate detail to expose sourcing
  summary, landed cost breakdown, MOQ, factory/source URL, and source evidence.
- [x] Add focused tests for 1688 provider normalization, sourcing candidate
  creation, landed cost calculation, scoring, and API response shape.
- [x] Select the production vendor chain: DajiSaaS primary and Apify backup.
- [x] Add a DajiSaaS adapter for signed keyword-search and product-detail
  responses, including response validation and 1688 evidence normalization.
- [x] Add an Apify adapter behind the same normalized sourcing contract.
- [x] Add sequential failover orchestration with structured reason logging,
  vendor provenance, and no parallel or merged automatic provider results.
- [x] Add provider-specific response fixtures and tests for success, invalid
  payload, timeout, rate limit, empty evidence, fallback success, and total
  provider failure.
- [x] Add sourcing verification workflow for human supplier validation before
  purchase/order decisions.

Deliverables:
- [x] Product Research has first-class `SOURCING` evidence support for
  candidate-level enrichment after a candidate exists.
- [x] Each enriched recommendation has persisted `SOURCING` ResearchSource
  evidence.
- [x] Candidate detail shows factory cost, MOQ, landed cost assumptions, margin, and
  sourcing risk.
- [x] 1688 evidence is clearly labeled as unverified sourcing evidence until a human
  or approved sourcing verification workflow confirms supplier quality.
- [x] Sourcing verification workflow with human checklist (factory exists, MOQ,
  price, samples, shipping, supplier responsiveness) and status tracking
  (UNVERIFIED, PENDING_VERIFICATION, VERIFIED, REJECTED, NEEDS_MORE_INFO).
- [x] SourcingVerification model with dedicated Prisma migration, repository,
  service, API routes, and dashboard UI.
- [x] Audit trail for all verification actions and candidate metadata sync.

Out of scope for Phase 7d:
- Purchase order automation
- Supplier-side order automation
- Inventory synchronization
- Warehouse, 3PL, or fulfillment operations
- Direct Shopify fulfillment integration from 1688

---

### Phase 7c Implementation Handoff

## STATUS: Phases 1–7i COMPLETE (2026-06-24)

| Phase | Name | Status |
|-------|------|--------|
| 1 | Project Bootstrap | ✅ |
| 2 | Database Layer | ✅ |
| 2b | Authentication | ✅ |
| 3 | Service Layer | ✅ |
| 4 | Agent Framework | ✅ |
| 5 | Workflow Engine | ✅ |
| 6 | API Layer | ✅ |
| 6b | API Per-Step Content Routes | ✅ |
| 7 | Dashboard | ✅ |
| 7b | Dashboard Per-Step Review & Edit | ✅ |
| 7c | Research Product Intelligence Module | ✅ |
| 7d | 1688 Sourcing Intelligence Upgrade | ✅ |
| 7e | AI-Assisted Source Match Review | ✅ |
| 7f | Autonomous Product Discovery Job | ✅ |
| 7g | Candidate-Level Sourcing Enrichment | ✅ |
| 7h | Product Aggregation & Two-Phase Discovery | ✅ |
| 7i | Provider-Backed Query Intelligence | ✅ |
| **8** | **Production Deployment** | ⬜ |

### Current pipeline summary

The full Research Product Intelligence pipeline is:

```
TREND / KEYWORD / SEARCH providers (query_intelligence stage)
    ↓
QueryIntelligenceService.selectQueries()
    ↓
seed query + capped derived queries (maxDerivedQueries config)
    ↓
MARKETPLACE / Apify providers (candidate_discovery stage, multi-query)
    ↓
ProductAggregationService.aggregate() — AI grouping + deterministic fallback
    ↓
buildCandidatesFromAggregatedGroups() — candidate drafts from aggregated groups
    ↓
candidateMatchesResearchBrief() — filter by price band, MOQ, excluded categories
    ↓
Phase 1: scoreDiscovery() — market signals only (demand, trend, competition,
  creativePotential, risk; margin only with cost data)
    ↓
Persist candidates, sources, audit log
    ↓
[Candidate selected by reviewer]
    ↓
CandidateSourcingService.enrichCandidate() — 1688 sourcing enrichment
    ↓
Phase 2: score() — all 10 factors with sourcing-backed data
    ↓
SourceMatchingService — AI-assisted demand/sourcing evidence match review
    ↓
promoteCandidate() — creates Product + starts Workflow at Content
```

Autonomous discovery also supported via DiscoveryJobService + BullMQ:

```
Dashboard brief (keyword optional)
    ↓
DiscoveryJobService → AI query planning (or deterministic fallback)
    ↓
BullMQ research-queue → product-discovery-job worker
    ↓
ResearchService.run() for each planned query
    ↓
Provider-backed candidates only, no AI fallback
```

Next: Phase 8 — Production Deployment (Docker, Docker Compose, Nginx, CI/CD).

---

### Phase 7e AI-Assisted Source Match Review

Goal:
- Increase confidence that demand/store evidence and sourcing evidence describe
  the same underlying product before the final Product Research output is used.
- Keep AI in an advisory reviewer role only. AI must not create product
  candidates, supplier evidence, source URLs, prices, MOQ, or fallback results.

Architecture flow:

```text
API Route / Server Action
    ↓
SourceMatchingService
    ↓
ResearchSourceRepository / ProductCandidateRepository
    ↓
AI Provider Interface
    ↓
External AI Provider
```

Tasks:
- [x] Add source match review types for `LIKELY_MATCH`, `POTENTIAL_MATCH`,
  `WEAK_MATCH`, `NOT_A_MATCH`, and `INSUFFICIENT_EVIDENCE`.
- [x] Add Zod schemas for source match review request, structured AI output,
  and human decision payloads.
- [x] Add SourceMatchingService to build evidence bundles from persisted
  ResearchSource records and candidate metadata.
- [x] Add an AI Provider prompt contract that returns only structured JSON with
  match status, confidence score, reasons, warnings, and recommended action.
- [x] Persist initial source match results in `ProductCandidate.metadata` or
  add a first-class model if query/reporting requirements justify a migration.
- [x] Add dashboard candidate-detail UI for match confidence, reasons,
  warnings, and reviewer actions.
- [x] Add API routes for running a source match review and persisting a human
  decision.
- [x] Add tests for likely match, potential match, weak match, not a match,
  insufficient evidence, and provider failure without AI-generated fallback.

Current status:
- Phase 7e source match foundation has been implemented (2026-06-23).
- `SourceMatchingService` compares only persisted `ResearchSource` records and
  candidate metadata, calls AI through the AI Provider interface, and persists
  auditable source match results in `ProductCandidate.metadata.sourceMatches`.
- API routes now exist for running reviews and persisting human decisions:
  `/api/product-research/candidates/:candidateId/source-matches/review` and
  `/api/product-research/candidates/:candidateId/source-matches/:matchId/decision`.
- The Product Research candidate detail dashboard now shows source match status,
  confidence, reasons, warnings, recommended action, and reviewer decision
  buttons.
- No Prisma migration was added for Phase 7e. Keep using metadata storage until
  querying/reporting requirements justify a first-class `ResearchSourceMatch`
  model.
- Local Node is currently `v16.14.0`, which fails Vitest startup because Vite
  needs `crypto.getRandomValues`. Verification was run successfully with Node 20.

Implemented Phase 7e files:
- `src/types/research.types.ts` — source match status, action, decision, and
  persisted result types.
- `src/schemas/research.schema.ts` — review request, AI output, result, and
  human decision schemas.
- `src/repositories/product-candidate.repository.ts` — metadata update method.
- `src/repositories/research-source.repository.ts` — scoped source lookup for a
  candidate review.
- `src/services/source-matching.service.ts` — evidence bundle construction,
  AI structured review, metadata persistence, and reviewer decision persistence.
- `src/app/api/product-research/candidates/[candidateId]/source-matches/review/route.ts`
  — source match review endpoint.
- `src/app/api/product-research/candidates/[candidateId]/source-matches/[matchId]/decision/route.ts`
  — human source match decision endpoint.
- `src/app/dashboard/product-research/actions.ts` and
  `src/app/dashboard/product-research/[projectId]/page.tsx` — dashboard source
  match actions and candidate detail panel.
- `tests/services/source-matching.service.test.ts` — focused service coverage.

Verification already run after Phase 7e implementation:
- `npm run type-check`
- `npx prisma validate`
- `git diff --check`
- `npx -p node@20 node ./node_modules/vitest/vitest.mjs run`

Implementation order:
1. Types and schemas: `src/types/research.types.ts`,
   `src/schemas/research.schema.ts`
2. Persistence contract: candidate metadata first, dedicated Prisma model only
   if needed
3. Repositories: read/update methods for candidate metadata and source lookup
4. Service: `src/services/source-matching.service.ts`
5. Provider contract: AI structured output through the existing AI provider
   abstraction
6. API routes under
   `/api/product-research/candidates/:candidateId/source-matches`
7. Dashboard candidate-detail source match review panel
8. Focused service, schema, API, and UI tests

Decision thresholds:
- `LIKELY_MATCH`: 90-100 confidence, may be shown as a high-confidence sourcing
  match but must remain source-auditable
- `POTENTIAL_MATCH`: 75-89 confidence, requires human confirmation before
  affecting final output
- `WEAK_MATCH`: 50-74 confidence, keep sources separate by default
- `NOT_A_MATCH`: below 50 confidence
- `INSUFFICIENT_EVIDENCE`: source data is too thin to decide

Guardrails:
- SourceMatchingService must use only persisted sources and candidate metadata.
- The service must not call DataForSEO, 1688, DajiSaaS, Apify, SerpAPI, Brave,
  Shopify, or Prisma directly.
- The AI prompt must explicitly reject missing data instead of guessing.
- Provider failure or weak source evidence must produce an auditable failure or
  `INSUFFICIENT_EVIDENCE`, never an AI-generated candidate or source.

---

### Phase 7f Autonomous Product Discovery Job

Goal:
- Allow the user to start a Product Research job without entering a specific
  keyword.
- Use AI to plan research directions only, then run provider-backed Product
  Research for each planned query.
- Preserve the current guardrail that ProductCandidate, supplier, cost, MOQ,
  landed cost, source URL, and source evidence must come from persisted
  provider evidence, not AI fallback output.

Architecture flow:

```text
Dashboard / API
    ↓
DiscoveryJobService
    ↓
ResearchDiscoveryJobRepository / ResearchProjectRepository
    ↓
BullMQ research-queue
    ↓
Discovery job worker
    ↓
DiscoveryJobService
    ↓
AI Provider Interface (query planning only)
    ↓
ResearchService
    ↓
Research Provider Interfaces
    ↓
External Research APIs
```

Tasks:
- [x] Add discovery job types for status, query plan, job input, and job result.
- [x] Add Zod schemas for autonomous discovery brief and AI query-plan output.
- [x] Add Prisma model and migration for `ResearchDiscoveryJob`.
- [x] Add `ResearchDiscoveryJobRepository`.
- [x] Add `DiscoveryJobService` for creating jobs, planning queries, running
  multiple `ResearchService.run()` calls, and persisting final job result.
- [x] Add BullMQ producer and worker handling for discovery jobs on the
  research queue.
- [x] Add Product Research API routes for starting/listing discovery jobs.
- [x] Add Product Research dashboard controls and job status display.
- [x] Add focused service tests for AI-planned queries, deterministic fallback,
  provider-empty outcomes, and no AI-generated candidate fallback.

Current status:
- Phase 7f autonomous discovery foundation has been implemented (2026-06-23).
- `ResearchDiscoveryJob` persists job input, status, AI/fallback query plan,
  result summary, and failure message.
- Product Research dashboard now has an AI Discovery Job form where keyword is
  optional; the job can start from market, price, margin, MOQ, risk, and
  excluded-category constraints.
- Discovery jobs run on `research-queue` using the `product-discovery-job`
  BullMQ job name.
- `DiscoveryJobService` uses AI only for query planning. If no usable AI
  provider is configured or the AI output is invalid, it uses deterministic
  query planning. Product candidates still come only from `ResearchService`
  provider-backed runs.

Implemented Phase 7f files:
- `prisma/schema.prisma` and
  `prisma/migrations/20260623120000_add_autonomous_discovery_jobs/migration.sql`
  — `ResearchDiscoveryJobStatus` enum and `ResearchDiscoveryJob` model.
- `src/schemas/research.schema.ts` and `src/types/research.types.ts` —
  autonomous discovery input, query plan, result, summary, and queue payload
  contracts.
- `src/repositories/research-discovery-job.repository.ts` — repository-only
  persistence operations for discovery jobs.
- `src/services/discovery-job.service.ts` — job creation, query planning,
  provider-backed research execution, result persistence, and audit logging.
- `src/jobs/product-discovery-job.ts`, `src/jobs/job-producer.ts`, and
  `src/jobs/worker.ts` — BullMQ enqueue and processing support.
- `src/app/api/product-research/discovery-jobs/route.ts` — list/start
  discovery job API.
- `src/components/dashboard/research-form.tsx`,
  `src/app/dashboard/product-research/actions.ts`, and
  `src/app/dashboard/product-research/page.tsx` — dashboard start form and job
  status table.
- `tests/services/discovery-job.service.test.ts` — focused service coverage.

Verification already run after Phase 7f implementation:
- `npm run db:generate`
- `npm run type-check`
- `npx prisma validate`
- `git diff --check`
- `npx -p node@20 node ./node_modules/vitest/vitest.mjs run tests/services/discovery-job.service.test.ts`
- `npx -p node@20 node ./node_modules/vitest/vitest.mjs run`

Guardrails:
- AI planner output can contain only research queries, angles, and rationale.
- The service must ignore any planner-provided product, supplier, price, MOQ,
  URL, or cost claims.
- Each discovery query must flow through `ResearchService`.
- Provider failures or empty evidence must produce an empty/failed job result,
  never an AI-created candidate.

---

### Phase 7g Candidate-Level Sourcing Enrichment

Product Research flow was updated on 2026-06-23 to split winning-product
discovery from factory sourcing:

- Initial Product Research and autonomous discovery runs collect candidate
  evidence from demand/store providers only by default.
- `ResearchService` filters providers through `supplementalProviders`; the
  default provider set excludes `sourcing` and legacy `supplier`.
- Candidate creation ignores `SOURCING` evidence. 1688 sourcing must enrich an
  existing ProductCandidate rather than creating a new one.
- Each candidate detail view exposes a Supplier / 1688 Sourcing action.
- The user may paste a 1688 URL or leave the URL blank and let the sourcing
  provider search from the candidate title/query.
- Candidate-level sourcing persists `SOURCING` ResearchSource rows with
  `candidateId`, updates factory cost, MOQ, landed cost, sourcing/factory/
  logistics scores, and stores enrichment status in candidate metadata.
- Manual 1688 URLs are saved as evidence even when provider detail data is not
  available; cost fields are updated only from provider-backed metrics.

Implemented Phase 7g files:
- `src/schemas/research.schema.ts` — candidate sourcing request schema.
- `src/repositories/product-candidate.repository.ts` — sourcing analysis update
  method.
- `src/services/candidate-sourcing.service.ts` — candidate-level 1688 enrichment
  orchestration.
- `src/services/research.service.ts` — default discovery excludes sourcing and
  candidate creation is limited to aggregated marketplace evidence.
- `src/app/dashboard/product-research/actions.ts` and
  `src/app/dashboard/product-research/[projectId]/page.tsx` — dashboard
  candidate sourcing form and revalidation.

Guardrails:
- Do not call 1688 providers from API routes, dashboard actions, agents, or
  workflow nodes directly.
- Do not create ProductCandidate records from the candidate sourcing action.
- Do not invent supplier URLs, factory costs, MOQ, or landed-cost metrics when
  the provider/manual evidence does not contain them.

---

### Phase 7h Product Aggregation and Two-Phase Candidate Discovery

Product Research must now split candidate discovery into two phases:

```text
Phase 1: raw provider listings -> normalized ResearchSource evidence
Phase 2: aggregated product groups -> ProductCandidate drafts
```

This is separate from candidate-level 1688 sourcing enrichment. Sourcing
enrichment remains a later action on an existing ProductCandidate.

Goal:
- Replace direct one-source-to-one-candidate creation with provider-backed
  aggregation across marketplace listings from multiple actors/providers.
- Use AI only to analyze and group existing provider-backed listings into
  coherent product groups. AI must not invent product names, prices, suppliers,
  URLs, costs, MOQ, source evidence, or fallback candidates.
- Preserve provider-first Product Research: provider-empty outcomes produce an
  empty shortlist or visible failure, not AI-generated products.

Source-type contract:
- `MARKETPLACE` is the only initial candidate-seeding evidence type.
- `SEARCH`, `TREND`, `KEYWORD`, `ADS_SIGNAL`, and `SOCIAL` may enrich scoring,
  risk flags, evidence panels, and confidence.
- `SOURCING` is excluded from initial discovery. It enriches an existing
  ProductCandidate through CandidateSourcingService.

Apify candidate discovery:
- Actor definitions live in `config/apify-candidate-discovery.json`.
- The Apify candidate discovery provider runs configured actors whose
  `providerType` is enabled by the validated research configuration.
- Actor dataset items normalize into ResearchSource evidence and feed
  ProductAggregationService; the provider must not create ProductCandidate
  records directly.

Persistence contract:
- Do not add a `ProductGroup` Prisma model in this phase.
- Product groups are transient service-layer outputs.
- Persist aggregation audit data in `ProductCandidate.metadata.aggregation`,
  including source IDs/URLs, actor/provider provenance, grouping method, and
  merged metrics.
- Link persisted ResearchSource records to the created candidate where the
  evidence supports that candidate.

Candidate output limit:
- Use the validated research run configuration for candidate output limits.
- Do not keep a hidden hardcoded top-5 limit once this phase is implemented.

Current status:
- Phase 7h product aggregation and two-phase candidate discovery has been
  implemented (2026-06-24).
- `ProductAggregationService` aggregates marketplace listings with AI grouping
  and deterministic fallback deduplication.
- `ResearchService.run()` now uses the full staged pipeline: query intelligence
  → marketplace collection → product aggregation → candidate draft building →
  Phase 1 discovery scoring.
- Phase 1 discovery scoring (`scoreDiscovery()`) excludes sourcing-dependent
  factors (supplier, sourcing, factoryCost, logistics).
- `ApifyCandidateDiscoveryProvider` normalizes actor dataset items into
  ResearchSource evidence only; it does not create ProductCandidate records.
- `MARKETPLACE` is the only initial candidate-seeding evidence type.
  `SOURCING` evidence is excluded from initial discovery.
- No `ProductGroup` Prisma model was created; aggregation audit data is
  persisted in `ProductCandidate.metadata.aggregation`.
- Candidate output limit respects the validated research run configuration.

Implemented Phase 7h files:
- `src/types/research.types.ts` — `ProductAggregationInput`,
  `ProductAggregationResult`, `ProductAggregationSource` types.
- `src/schemas/research.schema.ts` — `productAggregationSourceSchema`,
  `productAggregationGroupSchema`, `productAggregationMergedMetricsSchema`,
  `productAggregationAiOutputSchema`.
- `src/services/product-aggregation.service.ts` — AI grouping with
  deterministic fallback, merge metrics (median price, sum reviews/orders,
  max demandSignal, average rating, sourceCount).
- `src/services/research.service.ts` —
  `buildCandidatesFromAggregatedGroups()`, staged collection pipeline,
  `candidateMatchesResearchBrief()` filtering, `scoreDiscovery()` for Phase 1.
- `src/services/candidate-scoring.service.ts` — `scoreDiscovery()` with
  sourcing-excluded weights.
- `src/providers/research/apify-candidate-discovery.provider.ts` — actor
  discovery driven by `config/apify-candidate-discovery.json`.
- `tests/services/product-aggregation.service.test.ts` — 4 tests (AI grouping,
  deterministic fallback, SOURCING exclusion, group limit).
- `tests/services/research.service.test.ts` — 11 tests including aggregation
  pipeline, sourcing exclusion, query intelligence, and brief constraint
  filtering.

Verification already run after Phase 7h implementation:
- `npm run type-check`
- `npx prisma validate`
- `git diff --check`
- `npx -p node@20 node ./node_modules/vitest/vitest.mjs run tests/services/product-aggregation.service.test.ts` (4 passed)
- `npx -p node@20 node ./node_modules/vitest/vitest.mjs run tests/services/research.service.test.ts` (11 passed)
- `npx -p node@20 node ./node_modules/vitest/vitest.mjs run` (all 91 tests passed)

---

### Phase 7i Provider-Backed Query Intelligence and Phased Discovery

Current status:
- Phase 7i provider-backed query intelligence and phased discovery has been
  implemented (2026-06-24).
- `QueryIntelligenceService.selectQueries()` extracts derived queries from
  TREND, KEYWORD, and SEARCH evidence, then ranks, deduplicates, and caps them.
- `ResearchService.run()` uses staged orchestration: query intelligence
  providers first → QueryIntelligenceService → marketplace/Apify discovery
  with seed query + derived queries → ProductAggregationService → candidate
  drafts.
- `MarketplaceResearchProvider.discoveryQueryContexts()` iterates over
  `selectedQueries` and stamps `queryProvenance(metadata)` into rawData.
- `ApifyCandidateDiscoveryProvider.discoveryQueryContexts()` does the same,
  preserving `queryUsed`, `querySource`, `queryScore`, `querySourceTypes`,
  `queryReason`, and `collectionStage` in every normalized source.
- Seed query is always preserved as the first discovery query.
- Derived query count is capped by `maxDerivedQueries` (default 5, max 10).
- When query intelligence returns no usable derived queries, only the seed
  query is used. AI never invents fallback keywords.
- `TREND`, `KEYWORD`, `SEARCH`, `ADS_SIGNAL`, and `SOCIAL` evidence enriches
  scores and confidence; they do not create standalone candidates.
- `SOURCING` evidence is excluded from initial discovery.

Implemented Phase 7i files:
- `src/types/research.types.ts` — `QueryIntelligenceInput`,
  `ResearchCollectionContext` with stage/query provenance fields.
- `src/schemas/research.schema.ts` — `queryIntelligenceCandidateSchema`,
  `queryIntelligenceResultSchema`, `selectedDiscoveryQuerySchema`,
  `researchCollectionStageSchema`, `maxDerivedQueries` in config.
- `src/services/query-intelligence.service.ts` — extraction from TREND/KEYWORD/
  SEARCH evidence, scoring, deduplication, capping, seed query preservation.
- `src/services/research.service.ts` — staged `collectProviderSources()` with
  `query_intelligence` stage first, then `candidate_discovery` with derived
  queries passed via `collectionContext.selectedQueries`.
- `src/providers/research/marketplace.provider.ts` —
  `discoveryQueryContexts()`, `queryProvenance()` stamping.
- `src/providers/research/apify-candidate-discovery.provider.ts` —
  `discoveryQueryContexts()`, `queryProvenance()` stamping with actor ID.
- `src/providers/research/trend.provider.ts` — full trend response in rawData
  for query extraction including `relatedQueries`, `risingQueries`.
- `src/providers/research/keyword.provider.ts` — keyword metrics in normalized
  format with keyword text for extraction.
- `tests/services/query-intelligence.service.test.ts` — 2 tests (derived
  queries, fallback to seed-only).
- `tests/services/research.service.test.ts` — "should use provider-backed
  query intelligence before marketplace discovery" test.

Verification already run after Phase 7i implementation:
- `npm run type-check`
- `npx prisma validate`
- `git diff --check`
- `npx -p node@20 node ./node_modules/vitest/vitest.mjs run tests/services/query-intelligence.service.test.ts` (2 passed)
- `npx -p node@20 node ./node_modules/vitest/vitest.mjs run tests/services/research.service.test.ts` (11 passed)
- `npx -p node@20 node ./node_modules/vitest/vitest.mjs run` (all 91 tests passed)

---

## Phase 8

Production Deployment

Tasks:
- Docker
- Docker Compose
- Nginx
- CI/CD

Deliverables:
- Production ready platform
