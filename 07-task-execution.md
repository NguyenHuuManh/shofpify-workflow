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
for Search, Marketplace, Trend, Keyword, Ads Signal, and Supplier evidence.

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

### Phase 7c Implementation Handoff

Current status:
- Documentation has been updated for Research Product Intelligence Module
- No Phase 7c code, Prisma migration, repository, service, provider, API route, UI change, or test has been implemented yet
- Existing Research Product behavior is still the original AI-generated research summary flow

Before implementing Phase 7c, the next session must read:
- 01-prd.md — Research Product Intelligence Module scope, output, and FR-003a through FR-003f
- 02-sdd.md — Research Product module architecture, provider categories, pipeline, scoring, and review page requirements
- 03-ddd.md — ResearchRun, ProductCandidate, ResearchSource, ResearchSourceType, and ResearchCandidateStatus draft models
- 04-api-design.md — research run, candidates, candidate detail, candidate selection, and source evidence endpoints
- 05-engineering-standards.md — Research Data Rules and forbidden agent/provider access
- 06-deepseek.md — Research Provider Rules and required architecture flow
- 07-task-execution.md — this Phase 7c task list and handoff

Next implementation order:
1. Types
2. Zod schemas
3. Prisma schema and migration
4. Repositories
5. ResearchService and CandidateScoringService
6. Research provider interfaces and initial provider stubs
7. ResearchAgent upgrade
8. Workflow/API/server action refactor so Research execution is not duplicated
9. Research API routes
10. Research review UI V2
11. Focused tests

Approval gate:
- Do not generate Phase 7c code until the user explicitly approves the implementation plan for this module

Architecture warning:
- Do not let ResearchAgent, API routes, UI, repositories, or workflow nodes call external research APIs or provider SDKs directly
- Do not let ResearchAgent or workflow nodes persist ProductCandidate, ResearchRun, or ResearchSource records directly through repositories
- Use ResearchService for business logic and persistence coordination

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
