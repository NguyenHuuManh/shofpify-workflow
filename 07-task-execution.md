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
- [x] Update `ResearchService` candidate discovery so `SOURCING` evidence can
  create product candidates directly; do not restrict candidate generation to
  marketplace/search sources.
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
- [ ] Add sourcing verification workflow for human supplier validation before
  purchase/order decisions.

Deliverables:
- [x] Product Research can produce 1688-backed product candidates even when
  marketplace/search evidence is not the source of the candidate.
- [x] Each 1688-backed recommendation has persisted `SOURCING` ResearchSource
  evidence.
- [x] Candidate detail shows factory cost, MOQ, landed cost assumptions, margin, and
  sourcing risk.
- [x] 1688 evidence is clearly labeled as unverified sourcing evidence until a human
  or approved sourcing verification workflow confirms supplier quality.

Out of scope for Phase 7d:
- Purchase order automation
- Supplier-side order automation
- Inventory synchronization
- Warehouse, 3PL, or fulfillment operations
- Direct Shopify fulfillment integration from 1688

---

### Phase 7c Implementation Handoff

Current status:
- Documentation has been updated for Research Product Intelligence Module and
  the 1688 Sourcing Intelligence direction.
- Some Phase 7c implementation exists in the current codebase: ResearchProject,
  ResearchRun, ProductCandidate, ResearchSource persistence, ResearchService,
  CandidateScoringService, product-research routes, a dashboard page, and
  supplemental provider classes are present.
- Phase 7d 1688 sourcing foundation has been implemented. The codebase now has
  `SOURCING` evidence, explicit 1688 env variables, a
  `Sourcing1688ResearchProvider`, landed-cost calculation, sourcing/factory
  scoring, sourcing-backed candidate creation, and dashboard sourcing fields.
- The implementation is provider-wrapper ready. ✅ DajiSaaS primary adapter,
  Apify sequential backup adapter, and failover orchestration have been
  implemented (2026-06-22).
- Temporary operational status (2026-06-22): the DajiSaaS application is still
  pending vendor activation, so its credentials are intentionally not
  configured. Apify is therefore the active 1688 sourcing provider for now.
  This does not change the target architecture: once DajiSaaS is activated and
  passes a live smoke test, it returns to primary and Apify returns to backup.
- `SUPPLIER_PROVIDER_*` remains for legacy generic supplier evidence. New
  1688-specific work must use `SOURCING_1688_*`.

Implemented Phase 7d files:
- `prisma/schema.prisma` and
  `prisma/migrations/20260618120000_add_1688_sourcing_intelligence/migration.sql`
  — `SOURCING` source type and candidate sourcing fields.
- `.env.example` and `src/lib/env.ts` — `SOURCING_1688_PROVIDER`,
  `SOURCING_1688_API_KEY`, `SOURCING_1688_ENDPOINT`, plus
  `SOURCING_1688_DAJISAAS_*` and `SOURCING_1688_APIFY_*` credentials.
- `src/schemas/research.schema.ts` and `src/types/research.types.ts` —
  sourcing config, landed-cost assumptions, source metrics, score outputs,
  DajiSaaS response validation schemas, and `SourcingProviderAdapter` interface.
- `src/providers/research/sourcing-1688.provider.ts` — failover orchestrator
  with sequential DajiSaaS → Apify (no parallel, no merge, no AI fallback).
- `src/providers/research/dajisaas.provider.ts` — DajiSaaS signed adapter
  with documented MD5 parameter signing, GET keyword-search, product-detail
  enrichment, request timeouts, and explicit CNY preservation/conversion.
- `src/providers/research/apify-1688.provider.ts` — Apify adapter with
  actor run lifecycle (start → poll → fetch dataset).
- `src/providers/research/index.ts` — exports DajiSaasProvider, Apify1688Provider.
- `src/services/research.service.ts` — direct candidate creation from
  `SOURCING` evidence and landed-cost calculation.
- `src/services/candidate-scoring.service.ts` — sourcing, factory cost, and
  logistics scoring.
- `src/app/dashboard/product-research/[projectId]/page.tsx` — candidate detail
  display for factory cost, MOQ, landed cost, and sourcing scores.
- `tests/providers/research/sourcing-1688.provider.test.ts` — failover orchestration tests (9 tests).
- `tests/providers/research/dajisaas.provider.test.ts` — DajiSaaS contract tests (5 tests).
- `tests/providers/research/apify-1688.provider.test.ts` — Apify adapter tests (15 tests).
- `tests/services/research.service.test.ts`, and related provider/agent tests
  — focused coverage for the new sourcing path.

Before continuing Phase 7c/7d, the next session must read:
- 01-prd.md — Research Product Intelligence Module scope, output, and FR-003a through FR-003f
- 02-sdd.md — Research Product module architecture, provider categories, pipeline, scoring, and review page requirements
- 03-ddd.md — ResearchRun, ProductCandidate, ResearchSource, ResearchSourceType, and ResearchCandidateStatus draft models
- 04-api-design.md — research run, candidates, candidate detail, candidate selection, and source evidence endpoints
- 05-engineering-standards.md — Research Data Rules and forbidden agent/provider access
- 06-deepseek.md — Research Provider Rules and required architecture flow
- 07-task-execution.md — Phase 7c and Phase 7d task lists and handoff
- The actual code files listed in "Implemented Phase 7d files" above, because
  the docs intentionally describe the contract while the code shows current
  provider and scoring behavior.

Next implementation order:
1. Run the new Prisma migration in the target environment before using
   `SOURCING` data in persistent research runs.
2. Configure separate DajiSaaS and Apify credentials plus an explicit
   CNY-to-USD conversion rate in `.env`; never reuse one vendor's credential
   fields for the other.
3. Run an end-to-end Product Research test with a real DajiSaaS response and
   verify candidates, sources, CNY provenance, converted cost, landed cost, and
   dashboard output.
4. Validate the configured Apify actor input/output against a recorded dataset
   before relying on it as the production backup.
5. Force a DajiSaaS failure in a staging run and verify that Apify is called
   once, its evidence is persisted with `provider=apify`, and no vendor results
   are merged.
6. Add a supplier verification/review step before purchase decisions if the
   product direction moves beyond research into procurement.

DajiSaaS activation follow-up:
- [ ] Confirm the DajiSaaS 1688 application status is active.
- [ ] Configure `SOURCING_1688_DAJISAAS_API_KEY`,
  `SOURCING_1688_DAJISAAS_API_SECRET`, endpoint, country, and the explicit
  CNY-to-USD conversion rate without committing secrets.
- [ ] Run a live Chinese-keyword search and product-detail smoke test.
- [ ] Verify persisted sources use `provider=dajiSaas`, preserve raw CNY values,
  and expose converted factory/landed cost correctly.
- [ ] Reconfirm Apify is only called after a documented DajiSaaS failure or
  empty/invalid evidence response.

Approval gate:
- Do not add purchase/order automation, inventory sync, warehouse logic, 3PL
  logic, or direct supplier fulfillment integration without a separate approved
  architecture plan.

Architecture warning:
- Do not let ResearchAgent, API routes, UI, repositories, or workflow nodes call external research APIs or provider SDKs directly
- Do not let ResearchAgent or workflow nodes persist ProductCandidate, ResearchRun, or ResearchSource records directly through repositories
- Use ResearchService for business logic and persistence coordination
- Do not call 1688, scraper APIs, sourcing APIs, or provider SDKs outside
  `src/providers/research/`
- Do not treat 1688 evidence as verified supplier approval; it is sourcing
  research evidence until a human or approved sourcing verification workflow
  confirms supplier quality

Verification already run after Phase 7d implementation:
- `npm run db:generate`
- `npm run type-check`
- `npm test`
- `npx prisma validate`
- `git diff --check`

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
