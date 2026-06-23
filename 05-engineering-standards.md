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

1688, factory sourcing, scraper API, or sourcing-agent credentials must be read
from explicit environment variables. Do not overload generic supplier
credentials for a provider-specific integration once a first-class sourcing
provider exists.

Research providers must not produce fake or stub evidence in normal operation.
When a provider is not configured, it must return an empty source list and emit a
structured warning log with the provider name and missing configuration key.

Product Research candidate discovery must be provider-first. The service must
not use AI-generated candidate fallback when external providers are missing,
failing, or returning no usable evidence. In that case it must return an empty
shortlist or surface a visible failure state.

The 1688 sourcing provider chain must use DajiSaaS as primary and Apify as the
sequential backup. The fallback policy is mandatory:

- Call DajiSaaS first.
- Call Apify only when DajiSaaS is not configured, unavailable, rejected,
  rate-limited, timed out, fails response validation, or returns no usable
  normalized `SOURCING` evidence.
- Do not call Apify when DajiSaaS returns at least one usable source.
- Do not call both vendors in parallel and do not merge their results during
  automatic failover.
- If both vendors fail or return no usable evidence, return an empty shortlist
  or visible failure; never generate AI fallback candidates.
- Log the selected vendor, failover reason, request outcome, and evidence count
  without logging credentials or full sensitive request data.

DajiSaaS and Apify credentials must use separate explicit environment
variables. Normalized `ResearchSource.provider` values must preserve vendor
provenance rather than labeling both vendors only as `1688`.

Supplemental research providers should map external data into these source types:

- SEARCH for competitor pages, reviews, discussions, and comparison pages
- MARKETPLACE for listing price, rating, review count, variants, and complaint evidence
- SOURCING for 1688 offers, factory listings, MOQ, tiered prices, supplier/shop metadata, lead time, and landed-cost inputs
- TREND for demand direction, seasonality, and regional interest
- KEYWORD for volume, CPC, difficulty, and buyer-intent keyword evidence
- ADS_SIGNAL for active ads, creative angles, and saturation indicators
- SUPPLIER for legacy generic supplier cost, shipping, processing time, and reliability evidence

Sourcing data that affects ranking must preserve raw source evidence. 1688 data
must be treated as unverified sourcing evidence until a human or approved
sourcing verification workflow confirms supplier quality, MOQ, lead time,
sample availability, and production suitability.

Candidate creation must allow provider-backed sourcing evidence to create a
candidate directly when the evidence represents a specific product opportunity.
Do not restrict candidate discovery to marketplace or search evidence.

AI-assisted source matching is allowed only as an evidence reviewer. It may
compare persisted ResearchSource records and candidate metadata to estimate
whether marketplace/store evidence and sourcing evidence describe the same
product. It must return structured confidence, reasons, warnings, and an
action recommendation. It must not generate fallback candidates, supplier
sources, product URLs, prices, MOQ, or evidence.

Source match reviews that influence final recommendation, source linking, or
candidate promotion must be persisted or embedded in candidate metadata so the
decision remains auditable. Uncertain matches require human confirmation before
they affect the final output.

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
