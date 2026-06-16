# ENGINEERING STANDARDS

## Language

TypeScript Only

No JavaScript

---

## Framework

Next.js App Router

---

## Database

Prisma

Repository Pattern

---

## Folder Rules

src/

app/

components/

agents/

repositories/

services/

lib/

schemas/

types/

workflows/

jobs/

---

## Layer Rules

Controller

↓

Service

↓

Repository

↓

Prisma

---

## Forbidden

Agent → Prisma

Agent → Shopify API

Agent → Anthropic SDK

Agent → External Research API

Agent → Provider SDK

---

## Required

Agent → Service Layer

Service → Provider Layer

Provider → External API

Research Agent → Research Service

Research Service → Research Provider Interfaces

Research Provider → External Research API

---

## Research Data Rules

Research conclusions that affect candidate ranking, cost estimates, or approval recommendations must be linked to persisted source evidence when available.

AI-only estimates are allowed only when clearly marked as estimates and assigned lower confidence.

Research providers must normalize external API responses before data reaches the service layer.

Provider credentials must be read from environment variables only.

---

## Validation

Use Zod

All DTOs require schemas.

---

## Error Handling

Never throw raw errors.

Use AppError.

---

## Logging

Pino

Structured JSON logs only.

---

## Testing

Vitest

Minimum 80% coverage.

Critical services require tests.

```
```
