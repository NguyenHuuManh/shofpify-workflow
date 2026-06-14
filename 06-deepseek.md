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

CONTENT_GENERATED

SEO_GENERATED

LANDING_GENERATED

SHOPIFY_DRAFT_CREATED

PENDING_REVIEW

APPROVED

REJECTED

PUBLISHED
```

Never skip states.

Workflow state changes must be persisted.

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
