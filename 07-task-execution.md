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

## Phase 8

Production Deployment

Tasks:
- Docker
- Docker Compose
- Nginx
- CI/CD

Deliverables:
- Production ready platform