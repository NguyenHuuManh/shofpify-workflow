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

### Required Patterns (Always)

- Agent → Service Layer
- Service → Provider Layer
- Provider → External API
- Service → Repository → Prisma

### Shopify Integration

All Shopify operations MUST go through `src/services/shopify/`. Never call Shopify directly from agents, controllers, or UI.

### Repository Pattern

Repositories handle ONLY database reads and writes. They must NEVER contain business logic, API calls, or AI calls.

### Service Layer

Services handle business logic, workflow execution, validation coordination, and external integrations. Services must be reusable.

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
