# SYSTEM DESIGN DOCUMENT

## Architecture

Next.js Fullstack

---

## Core Services

Frontend

Dashboard

Review Center (per-section: Research, Content, SEO, Landing)

Agent Monitoring

Workflow Manager

Research Product Intelligence Module

Query Intelligence Service

Product Aggregation Service

Candidate Scoring Service (Two-Phase)

Candidate Sourcing Service (1688 Enrichment)

---

## Backend

Route Handlers

Server Actions

BullMQ Workers

LangGraph

Research Providers

---

## Infrastructure

Nginx

Next.js

PostgreSQL

Redis

Worker

---

## Sequence

Create Product Research Project

↓

Research Service

↓

Query Intelligence Providers (Trend, Keyword, lightweight Search)

↓

Query Intelligence Service (provider-backed derived queries)

↓

Candidate Discovery Providers (DataForSEO Merchant Google Shopping primary,
Apify marketplace actors fallback/additional)

↓

Normalize Raw Listings into ResearchSource Evidence

↓

Product Aggregation Service (AI-powered grouping of MARKETPLACE evidence)

↓

Build ProductCandidate Drafts

↓

Candidate Enrichment Providers (Search, Trend, Keyword, Ads, Social)

↓

Phase 1: Discovery Scoring (market signals only)

↓

Product Candidate Ranking (discovery)

↓

Select Candidate

↓

Candidate Sourcing Service (1688 enrichment)

↓

Phase 2: Full Scoring (all 10 factors)

↓

Promote Candidate to Product

↓

Workflow Service

↓

Content Agent

↓

Content Review + Edit

↓

SEO Agent

↓

SEO Review + Edit

↓

Landing Agent

↓

Landing Review + Edit

↓

Shopify Agent

↓

Final Review

↓

Approval

↓

Publish

---

## Per-Section Review & Edit Pages

Each production generation step (Content, SEO, Landing) has a dedicated dashboard page at:

```
/dashboard/workflows/:id/content
/dashboard/workflows/:id/seo
/dashboard/workflows/:id/landing
```

Each page provides:
- View generated content
- Edit any field inline before approving
- Approve → proceed to next step
- Reject with feedback → trigger re-generation

The dashboard also exposes a top-level Product Research menu at:

```
/dashboard/product-research
```

This page acts as an independent research workbench and provides:
- Active and completed research project visibility
- Product brief input for idea/niche, target market, objective, price band,
  margin target, maximum MOQ, landed-cost assumptions, risk tolerance, and
  excluded categories
- Candidate shortlist status and selected candidate summary when available
- Candidate comparison snapshot for top shortlisted products
- Candidate promotion into a product creation workflow
- Autonomous discovery job controls for starting a provider-backed winning
  product search from broad market constraints without requiring a keyword

---

## Review Gates

Each production generation step (Content, SEO, Landing) is followed by a review gate. Product Research uses candidate selection instead of a workflow review gate.

Approve → proceed to next step.

Reject → return to the generating step for rework (max 3 reworks per step).

---

## Retry Strategy

Agent Failure:

Retry 3 times

Exponential Backoff

5s

15s

45s

---

## Queue Strategy

research-queue

content-queue

seo-queue

landing-queue

publish-queue

---

## Event Driven

workflow.created

research.completed

content.completed

seo.completed

review.approved

product.published

```
```

---

## Research Product Intelligence Module

Product Research is a dedicated module responsible for discovering, validating, scoring, and recommending product candidates before a product creation workflow begins.

The module follows the platform architecture:

```text
API Route / Server Action
    ↓
Research Service
    ↓
Research Repositories
    ↓
Prisma
    ↓
Database
```

Agent execution follows:

```text
Research Agent
    ↓
Research Service
    ↓
Research Provider Interfaces
    ↓
External Research APIs
```

The Research Agent must not call external research APIs, Prisma, Redis, Shopify APIs, or provider SDKs directly. Workflow execution should consume only a selected/promoted candidate snapshot and should not run Product Research as a mandatory workflow step.

---

## Autonomous Product Discovery Job

Autonomous discovery is a background Product Research job that expands a broad
brief into multiple provider-backed research runs.

The job follows this flow:

```text
Dashboard / API
    ↓
Discovery Job Service
    ↓
ResearchDiscoveryJob Repository
    ↓
BullMQ research-queue
    ↓
Discovery Job Worker
    ↓
Discovery Job Service
    ↓
AI Provider Interface (query planning only)
    ↓
Research Service
    ↓
Research Provider Interfaces
    ↓
External Research APIs
```

The AI planning step may generate niche hypotheses, keyword batches, and
research angles. It must not create ProductCandidate records, supplier records,
source URLs, prices, MOQ, landed cost, or source evidence. Every candidate
created by the job must come from the underlying ResearchService provider
evidence pipeline.

The job creates one ResearchProject and then runs multiple ResearchRun records
under that project. Each run uses one planned query and the same validated
research constraints. The project candidate list remains the review surface for
selecting and promoting a winner.

Job statuses:

```text
PENDING
RUNNING
COMPLETED
FAILED
CANCELLED
```

Provider failure or missing credentials must produce an empty shortlist or a
visible failed/empty job result. It must not cross into AI-generated fallback
candidate creation.

---

## Research Data Sources

Research data must be collected through provider interfaces so providers can be replaced without changing business logic.

Initial provider categories:

- Search Provider: web results, competitor pages, review articles, discussion pages
- Marketplace Provider: listing price, reviews, ratings, sellers, common complaints, product variants
- Trend Provider: demand trend, seasonality, regional interest, related/rising queries when available
- Keyword Provider: search volume, keyword difficulty, CPC estimates, buyer-intent keyword candidates
- Ads Signal Provider: active ad examples, creative angles, saturation signals
- Sourcing Provider: factory unit cost, MOQ, tiered prices, domestic supplier shipping, lead time, supplier reliability, and factory/trader signals
- Social Listening Provider: customer pain points, objections, emotional language

Provider output must be normalized before persistence.

Query intelligence runs before marketplace candidate discovery. With a user
seed query, it uses provider-backed `TREND`, `KEYWORD`, and lightweight
`SEARCH` evidence to extract candidate search terms such as rising queries,
related queries, high-volume buyer-intent keywords, and useful
problem/alternative terms from search result titles or snippets. Without a user
seed query, autonomous discovery uses DataForSEO Labs root-discovery evidence to
collect broad provider-backed category/keyword opportunities instead of
project hardcoded category seeds. These terms are ranked and capped before they
are passed into marketplace and Apify discovery providers.

Query intelligence must remain evidence-backed:

- Derived queries must come from provider responses or normalized source
  evidence.
- AI may rank, filter, deduplicate, or explain derived queries only when the
  query text is present in provider-backed evidence.
- The seed query remains included even when query intelligence is empty.
- Marketplace and Apify providers must record `queryUsed`, `querySource`,
  `queryScore`, and `collectionStage` in `rawData` for downstream auditability.
- Query intelligence must not create ProductCandidate records directly.

Supplemental provider implementations must use approved API integrations only. If
credentials are missing, providers must return no evidence and log a structured
warning; they must not fabricate stub evidence. Supported supplemental provider
families include:

- Search and competitor discovery via search APIs such as DataForSEO SERP,
  Brave Search, or SerpAPI
- Marketplace intelligence via DataForSEO Merchant Google Shopping as the
  primary product-query validation source, with Apify marketplace actors or
  other approved marketplace providers as fallback/additional evidence
- Trend and keyword intelligence via DataForSEO trend/keyword APIs or SerpAPI
- Ads signal intelligence via approved ads libraries or ads intelligence providers
- Factory sourcing intelligence via 1688, Alibaba-family sourcing APIs, or
  approved scraper/API providers that expose public sourcing evidence

1688 is the primary target source for factory cost intelligence. A 1688
provider must be implemented as a Research Provider, not as a Shopify,
workflow, agent, or UI integration. It must normalize product search and detail
responses into source evidence before the Research Service performs scoring,
candidate creation, landed cost calculation, or persistence.

The selected 1688 vendor strategy is:

```text
DajiSaaS (primary)
    ↓ only when unavailable, failed, rate-limited, timed out, or no usable evidence
Apify (backup)
    ↓ no usable evidence
Empty shortlist or visible research failure
```

DajiSaaS and Apify must be invoked sequentially, never in parallel for the same
sourcing request. Apify must not be called when DajiSaaS returns at least one
valid normalized `SOURCING` source. Results from the two vendors must not be
merged during automatic failover. Both adapters must normalize into the same
Research Provider contract, while preserving the actual vendor name and raw
1688 payload for provenance and auditability. Failure of both vendors must not
trigger AI-generated candidates or source evidence.

1688 evidence should include, when available:

- Offer ID and product URL
- Product title, images, variants, and SKU attributes
- Factory unit cost and tiered price breaks
- MOQ
- Domestic China shipping cost
- Supplier/shop name, location, years active, badges, and transaction signals
- Factory/trader signal when available
- Lead time or processing time
- Raw response payload for auditability

All provider evidence must be persisted as ResearchSource records with provider,
URL or external identifier when available, extracted signal, confidence, rawData,
and capturedAt. AI may synthesize or summarize provider-backed evidence after
collection, but it must not create fallback product candidates or fallback
source evidence when providers return no usable data.

---

## Apify Candidate Discovery

Apify-backed candidate discovery is part of the general marketplace evidence
pipeline, not the 1688 sourcing failover path.

DataForSEO Merchant Google Shopping is the preferred marketplace validation
provider for product-like keyword queries. The Merchant provider must live in
the Research Provider layer, call only DataForSEO Merchant APIs, and normalize
Google Shopping product results into `MARKETPLACE` ResearchSource records.
Normalized Merchant evidence should preserve product title, URL or product ID,
price, currency, seller/shop signal, rating, review or vote count when
available, image/product metadata when available, and query provenance
(`queryUsed`, `querySource`, `queryScore`, `collectionStage`).

Merchant validation answers whether a keyword maps to real products being sold.
It does not replace ProductAggregationService. DataForSEO Merchant can return
multiple listings for the same underlying product across shops or offer pages,
so its output must still feed ProductAggregationService before any
ProductCandidate is created.

The marketplace provider policy is:

- Use DataForSEO Merchant Google Shopping first when configured.
- If Merchant is unavailable, unconfigured, fails, or returns no usable
  `MARKETPLACE` evidence, use Apify marketplace actors as fallback/additional
  evidence.
- Do not let any marketplace provider create ProductCandidate records directly.
- Do not use Google Shopping keyword or SERP evidence alone as a product
  candidate; only normalized `MARKETPLACE` listings can seed aggregation.

Actor definitions live in:

```text
config/apify-candidate-discovery.json
```

Each actor definition declares its Apify actor ID, source type, provider type,
maximum items, and templated actor input. The Apify candidate discovery provider
may run configured actors whose `providerType` is enabled by the validated
research configuration. Dataset items are normalized into ResearchSource
records, primarily `MARKETPLACE` evidence.

The provider must not create ProductCandidate records directly. Its output feeds
ProductAggregationService along with other marketplace provider evidence.

---

## AI-Assisted Source Match Review

Product Research may use AI to review whether two persisted source records
appear to describe the same underlying product, for example a marketplace/store
listing and a 1688 sourcing offer.

The review flow is:

```text
API Route / Server Action
    ↓
SourceMatchingService
    ↓
AI Provider Interface
    ↓
External AI Provider
```

The SourceMatchingService must build an evidence bundle from existing
ResearchSource records and ProductCandidate metadata. It must not call external
research APIs directly, create replacement candidates, or invent missing source
data. Repositories remain responsible only for reading and writing persisted
records.

The AI output must be structured:

- `LIKELY_MATCH`: 90-100 confidence, strong title/image/spec/economics overlap
- `POTENTIAL_MATCH`: 75-89 confidence, plausible match but needs human review
- `WEAK_MATCH`: 50-74 confidence, do not link automatically
- `NOT_A_MATCH`: below 50 confidence
- `INSUFFICIENT_EVIDENCE`: source data is too thin to decide

Each review result must include confidence score, supporting reasons, warnings,
and a recommended action such as `LINK_AS_SOURCING_MATCH`, `KEEP_SEPARATE`, or
`FIND_BETTER_SOURCING_MATCH`.

Automatic recommendation logic may use only high-confidence reviewed matches
that remain traceable to the original sources. `POTENTIAL_MATCH`, `WEAK_MATCH`,
and `INSUFFICIENT_EVIDENCE` require a visible human decision before they affect
the final output.

---

## Research Pipeline

The Research Product Intelligence Module runs the following pipeline:

```text
Input Product Idea / Niche
    ↓
Apply Research Brief Constraints
    ↓
Collect Query Intelligence Evidence (TREND, KEYWORD, lightweight SEARCH)
    ↓
QueryIntelligenceService ranks provider-backed derived queries
    ↓
Collect Candidate Discovery Evidence using seed query + derived queries
    ↓
DataForSEO Merchant validates product-like queries with MARKETPLACE listings
    ↓
Normalize Evidence
    ↓
Persist/Prepare Normalized ResearchSource Evidence
    ↓
ProductAggregationService groups MARKETPLACE evidence
    ↓
Build ProductCandidate Drafts From Aggregated Groups
    ↓
Estimate Sourcing Cost, Landed Cost, and Profit
    ↓
Score Candidates
    ↓
Generate Risks and Recommendation
    ↓
Persist Research Run
    ↓
Candidate Selection
    ↓
Promote Candidate to Product Workflow
```

Product candidates must be seeded from `MARKETPLACE` provider evidence after
ProductAggregationService groups raw listings into unified product groups.
`SEARCH`, `TREND`, `KEYWORD`, `ADS_SIGNAL`, and `SOCIAL` evidence can enrich
score inputs, risk flags, confidence, and source panels, but they must not
create candidates by themselves in the initial discovery phase. If providers are
unavailable or return no usable marketplace evidence, Product Research must
return an empty shortlist or fail visibly; it must not fall back to
AI-generated product candidates.

Research brief constraints are applied after provider evidence is normalized and
candidate drafts are derived. Constraints such as excluded categories, maximum
MOQ, and price band may remove candidates from the shortlist, but they must not
trigger AI-generated replacements.

Sourcing evidence must not create initial ProductCandidate records. It enriches
an existing candidate through CandidateSourcingService after discovery and
selection/review actions expose a candidate-level 1688 sourcing workflow.

ProductAggregationService stores no ProductGroup table in the initial
implementation. Product groups are transient service-layer outputs. The final
candidate metadata must preserve aggregation details, source IDs or URLs, actor
provenance, and merged metrics so the recommendation remains auditable.

Derived query outputs are transient service-layer results. The initial
implementation should avoid a dedicated query-intelligence database table and
persist auditability through `ResearchRun.input`, `ResearchSource.rawData`, and
candidate aggregation metadata.

---

## Candidate Scoring

Each product candidate receives a score breakdown:

- Demand Score
- Trend Score
- Competition Score
- Margin Score
- Sourcing Score
- Factory Cost Score
- Logistics Score
- Creative Potential Score
- Risk Score
- Winning Score

The Winning Score is a weighted aggregate. The scoring weights must be configurable in the service layer or settings.

Margin scoring must use landed cost when available. Landed cost is an estimate
derived from factory unit cost, MOQ, tiered price, domestic supplier shipping,
international freight assumptions, agent fee assumptions, packaging/QC cost,
customs/duty assumptions, and payment fees. Missing landed-cost components must
be explicitly marked as assumptions or unknowns, not silently treated as zero.

---

## Product Research Workbench

The Product Research page must support:

- Ranked product candidate list
- Top-candidate comparison table with score, economics, sourcing, and evidence
  quality
- Score breakdown per candidate
- Factory sourcing, landed cost, and margin analysis
- Source evidence panel
- AI-assisted source match panel with confidence, reasons, warnings, and human
  actions for linking or rejecting candidate-source matches
- Competitor and sourcing summaries
- Risk flags
- Candidate selection action
- Candidate promotion action that creates Product and starts Workflow at Content
- Autonomous discovery job list with status, query count, run count, candidate
  count, and top provider-backed candidates

Starting the production workflow requires selecting a candidate. The selected candidate becomes the input context for Content generation.
