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

Research providers must not produce fake or stub evidence in normal operation.
When a provider is not configured, it must return an empty source list and emit a
structured warning log with the provider name and missing configuration key.

Product Research candidate discovery must be provider-first. The service must
not use AI-generated candidate fallback when external providers are missing,
failing, or returning no usable evidence. In that case it must return an empty
shortlist or surface a visible failure state.

Supplemental research providers should map external data into these source types:

- SEARCH for competitor pages, reviews, discussions, and comparison pages
- MARKETPLACE for listing price, rating, review count, variants, and complaint evidence
- TREND for demand direction, seasonality, and regional interest
- KEYWORD for volume, CPC, difficulty, and buyer-intent keyword evidence
- ADS_SIGNAL for active ads, creative angles, and saturation indicators
- SUPPLIER for cost, shipping, processing time, and supplier reliability

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
