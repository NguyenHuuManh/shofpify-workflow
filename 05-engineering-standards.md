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

---

## Required

Agent → Service Layer

Service → Provider Layer

Provider → External API

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
