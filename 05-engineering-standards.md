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

Candidate discovery is a two-phase pipeline:

```text
raw provider listings -> aggregated product groups -> ProductCandidate drafts
```

Before marketplace listing collection, Product Research may run a provider-backed
query intelligence phase:

```text
TREND / KEYWORD / lightweight SEARCH evidence
    -> QueryIntelligenceService
    -> seed query + capped derived queries
    -> MARKETPLACE / Apify candidate discovery
```

Query intelligence must not create ProductCandidate records. It only selects
search terms for downstream provider calls and enrichment. Derived query text
must come from provider-backed evidence such as DataForSEO Labs keyword
suggestions generated from the seed product, related/rising trend queries,
keyword-volume results, or search result titles/snippets. AI may only rank,
filter, deduplicate, or explain existing provider-backed query candidates; it
must not invent keywords, product ideas, URLs, prices, suppliers, or evidence.
When query intelligence returns no usable derived queries, the system must use
the original seed query only instead of generating AI fallback keywords.
Discovery jobs must require an original seed product from the user. The system
must not start by generating seed products, hardcoded category seed lists, or
provider-root broad categories as a substitute for user intent.

The initial discovery run must seed candidates from `MARKETPLACE` evidence
after ProductAggregationService groups listings from multiple providers.
DataForSEO Merchant Google Shopping is the preferred market-validation source
for product-like discovery queries and must run before additive Apify
marketplace discovery. Merchant results must be normalized into `MARKETPLACE`
ResearchSource evidence and must not create ProductCandidate records directly.
Apify marketplace actors should run after Merchant for the seed query plus
selected derived queries as additive marketplace evidence, not as a
Merchant-only fallback path.
`SEARCH`, `TREND`, `KEYWORD`, `ADS_SIGNAL`, and `SOCIAL` evidence may enrich
scores, risk flags, source panels, and confidence. They must not create
standalone candidates in the initial discovery phase. The initial discovery run
must not call 1688/sourcing providers by default; 1688 supplier lookup, factory
cost, MOQ, and landed-cost analysis happen through candidate-level sourcing
enrichment after a candidate already exists.

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

Candidate creation for the current Product Research flow must come from
aggregated demand/store marketplace evidence. `SOURCING` evidence is attached
to an existing candidate during enrichment and must not create a new
ProductCandidate in initial discovery or in the candidate sourcing action.

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

Autonomous product discovery jobs may use AI only to rank, filter, or explain
provider-backed keyword candidates derived from the user seed product. The job
service must persist the query plan and then call ResearchService for the seed
product plus selected provider-backed derived queries. ProductCandidate,
ResearchSource, supplier, cost, MOQ, landed-cost, and source URL data must come
from approved providers and repositories, not from AI planner output.

---

## Product Aggregation Rules

Product candidate discovery must aggregate marketplace listings from multiple
external providers into unified product candidates before individual candidate
creation.

The aggregation input for candidate seeding is `MARKETPLACE` source evidence.
Other non-sourcing source types can support scoring and confidence, but they
must not seed initial ProductCandidate records by themselves.

Apify-backed candidate discovery must read actor definitions from
`config/apify-candidate-discovery.json`. The provider may run configured actors
whose `providerType` is enabled by the research configuration. The actor config
controls actor selection, actor input, and per-actor `maxItems`; candidate
shortlist size is controlled by validated run config. When query intelligence
is available, Apify-backed discovery should run configured actors against the
seed query plus selected derived queries, while recording query provenance in
each normalized ResearchSource `rawData`.

DataForSEO Merchant Google Shopping validation must run in the provider layer.
The provider must normalize product title, URL or product ID, price, currency,
seller/shop signal, rating, review or vote count when available, and query
provenance into `MARKETPLACE` evidence. Merchant validation establishes that a
query maps to real marketplace products; aggregation is still required to merge
duplicate or similar listings into ProductCandidate drafts.

The Product Aggregation step must use AI exclusively to analyze and group
provider-backed listings. AI must:

- Group items that describe the same real-world product based on product name,
  price cluster, review/order scale, and provider context
- Never fabricate product names, prices, URLs, suppliers, or source evidence
- Assign each selected listing to at most one group
- Leave weak, noisy, broad, or unrelated listings unassigned instead of forcing
  them into low-quality groups
- Place uncertain but still product-like matches in separate groups

When the AI provider is unavailable, misconfigured, or returns invalid output,
multi-source aggregation must return no product groups and surface an
empty/failed provider-backed result instead of silently falling back to
deterministic name-based deduplication.

Merged metrics per product group must apply these rules:

- demandScore: maximum across all sources
- price: median (with min/max range preserved)
- rating: arithmetic mean
- reviewCount and orderCount: sum across all sources
- sourceCount: used for confidence scoring

Product Aggregation must operate entirely within the service layer. AI calls
for grouping must go through the AI Provider interface. The aggregation service
must not call external research APIs, provider SDKs, or Prisma directly.
Do not create a ProductGroup database table in this phase. Product groups are
transient service-layer outputs; persist auditability through ProductCandidate
metadata and linked ResearchSource records.

---

## Two-Phase Candidate Scoring Rules

Candidate scoring must be split into two distinct phases:

**Phase 1 — Discovery Scoring:**

- Only market-signal factors are active: demand, trend, competition,
  creative potential, risk
- marginScore is included only when landedCost or COGS data is available
- Sourcing-dependent factors (supplier, sourcing, factoryCost, logistics)
  must be excluded
- Weights must be re-normalized across active factors only
- This phase runs during ResearchService.run() candidate creation

**Phase 2 — Full Scoring:**

- All ten factors are active with full original weights
- Runs after CandidateSourcingService.enrichCandidate() completes 1688
  sourcing enrichment
- Replaces the candidate's winningScore and individual factor scores with
  sourcing-backed data
- Must update the ProductCandidate record with the new scores

Margin estimation rules:

- When price is available but COGS/landedCost is missing, marginScore must
  fall back to 50 and candidate metadata must flag marginEstimated: true
- Never compute marginScore from price alone (price - 0 = 100% margin is
  misleading)
- When landedCost is available from 1688 enrichment, use actual landedCost
  for margin calculation

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
