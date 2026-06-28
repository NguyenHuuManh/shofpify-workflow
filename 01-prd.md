# Product Requirements Document (PRD)

# Shopify Autonomous Store Platform

Version: 1.0

Status: Final current

---

# 1. Executive Summary

Shopify Autonomous Store Platform is an AI-powered system that automates the process of researching products, generating content, creating Shopify resources, and publishing products through a controlled approval workflow.

The platform is designed to reduce manual effort in product creation while maintaining quality through mandatory human review.

The application will be built as a Next.js Fullstack platform and integrate with Shopify, Claude API, PostgreSQL, Redis, BullMQ, and LangGraph.

---

# 2. Product Vision

Enable a business owner to create and publish a complete Shopify product by providing only a product idea.

Example:

```text
Portable Blender
```

The platform should separate product discovery from product production:

```text
Product Research
    ↓
Select Product Candidate
    ↓
Start Product Workflow
    ↓
Generate Product Content
    ↓
Review & Edit Content
    ↓
Generate SEO Metadata
    ↓
Review & Edit SEO
    ↓
Generate Landing Page
    ↓
Review & Edit Landing Page
    ↓
Generate Image Prompts
    ↓
Create Shopify Draft
    ↓
Final Review
    ↓
Publish Product
```

---

# 3. Business Goals

## Goal 1

Reduce product creation time by at least 90%.

---

## Goal 2

Standardize product content quality.

---

## Goal 3

Enable non-technical users to manage product publishing.

---

## Goal 4

Provide full visibility into AI-generated workflows.

---

## Goal 5

Maintain human control before publishing.

---

# 4. Target Users

## Store Owner

Responsibilities:

* Submit product ideas
* Review generated content
* Approve publishing

---

## Content Reviewer

Responsibilities:

* Review generated content
* Review SEO
* Approve or reject workflows

---

## Administrator

Responsibilities:

* Configure platform settings
* Monitor workflows
* Monitor AI usage
* Manage users

---

# 5. Scope

## In Scope

### Product Research

The system must:

* Analyze products
* Generate customer personas
* Identify pain points
* Identify competitors
* Generate USPs
* Discover and rank product candidates from a user-provided seed product plus
  research constraints
* Collect evidence from external research sources through provider integrations
* Extract provider-backed trending, related, and buyer-intent keywords before
  marketplace discovery so downstream providers search on higher-quality query
  terms instead of only the original product idea
* Validate product-like discovery queries through DataForSEO Merchant Google
  Shopping marketplace evidence before creating product candidates
* Discover candidates through two phases: collect raw provider listings, then
  aggregate those listings into candidate drafts before any ProductCandidate is
  created
* Aggregate marketplace listings from DataForSEO Merchant, Apify, and other
  approved marketplace sources into unified candidate drafts using AI-powered
  product grouping, merging demand signals, pricing, reviews, and order
  volumes across providers
* Estimate factory cost, sourcing cost, landed cost, gross margin, break-even ROAS, and pricing feasibility
* Score each product candidate through two phases:
  - **Phase 1 (Discovery):** market-signal scoring (demand, trend, competition,
    creative potential, risk) with margin estimated only when landed cost data
    is available
  - **Phase 2 (Full):** complete scoring including supplier, sourcing, factory
    cost, and logistics factors after candidate-level 1688 sourcing enrichment
* Produce a recommendation for the best product candidate to continue into content generation

---

### Research Product Intelligence Module

Product Research must evolve from AI-only market synthesis into a structured product intelligence module that is independent from the product creation workflow.

The module must:

* Accept a required seed product plus structured constraints such as target
  market, price band, margin target, MOQ tolerance, sourcing assumptions, risk
  tolerance, and excluded categories
* Generate multiple product candidates instead of a single research summary
* Gather supporting data through approved provider interfaces
* Use DataForSEO Labs and keyword providers for provider-backed product-query
  discovery, then use DataForSEO Merchant Google Shopping as the primary
  marketplace validation source for product-like queries
* Aggregate multi-source marketplace listings into unified candidate drafts
  using AI-powered product grouping before individual ProductCandidate creation
* Use query intelligence from approved trend, keyword, and search providers to
  build a capped set of derived marketplace discovery queries, while preserving
  the original seed query and source provenance for auditability
* Persist raw source evidence used for scoring and recommendations
* Rank candidates by commercial viability through two-phase scoring:
  discovery-phase market signals first, full sourcing-adjusted scoring after
  1688 enrichment
* Highlight factory cost, sourcing, fulfillment, competition, legal, seasonality, and saturation risks
* Allow a human reviewer to select one candidate and promote it into the product creation workflow

The module output must include:

* Ranked product candidate list
* Candidate comparison snapshot for shortlisted products
* Score breakdown per candidate
* Sourcing, landed cost, and profit analysis
* Market research summary
* Source evidence
* AI-assisted source match review between demand/store evidence and sourcing
  evidence, using only persisted provider evidence
* Risk flags
* Final recommendation

---

### Autonomous Product Discovery Job

Product Research must use a seed-product discovery job as the only user-facing
entrypoint for finding winning product opportunities. The job must start from a
specific seed product entered by the user.

The job must:

* Start from the user seed product plus target market, objective, price band,
  margin target, maximum MOQ, risk tolerance, and excluded categories
* Use AI only to rank, filter, or explain provider-backed keyword candidates;
  AI must not generate seed products or new product ideas
* Execute provider-backed Product Research runs from the seed product and
  capped provider-backed derived queries
* Create product candidates only from persisted external provider evidence
* Rank discovered candidates by demand, trend, competition, sourcing,
  landed-cost feasibility, margin, creative potential, and risk
* Persist job status, generated query plan, run summaries, candidate counts,
  top candidates, failure reason, and audit trail
* Return an empty shortlist or visible failure when providers return no usable
  evidence instead of generating AI fallback products, suppliers, URLs, costs,
  MOQ, or source evidence

The autonomous job output must include:

* Discovery project
* Query plan used by the job
* Research runs created by each query
* Ranked provider-backed candidate shortlist
* Source evidence and sourcing cost analysis inherited from the underlying
  Product Research runs
* Job status and failure diagnostics

---

### Content Generation

The system must generate:

* Product title
* Product description
* Benefits
* Features
* FAQ
* CTA

---

### SEO Generation

The system must generate:

* Meta title
* Meta description
* URL slug
* Keywords

---

### Landing Page Generation

The system must generate:

* Hero section
* Benefits section
* Features section
* Testimonials section
* FAQ section
* CTA section

---

### Shopify Integration

The system must:

* Create products
* Create collections
* Create pages
* Update resources
* Publish resources

---

### Review Workflow

The system must:

* Support per-step approvals (Research, Content, SEO, Landing)
* Support final approval before publishing
* Support rejections with step-specific feedback
* Support rework loops (reject → regenerate)
* Support comments
* Track review history per step

---

### Workflow Monitoring

The system must:

* Track workflow progress
* Track agent execution
* Track failures
* Track AI usage

---

# 6. Out of Scope

Version 1 will not include:

* Inventory Management
* Dynamic Pricing
* Order Fulfillment
* Customer Support Automation
* Ad Campaign Management
* Analytics Dashboard

Supplier and factory sourcing research for cost estimation is in scope for the Research Product Intelligence Module. This includes collecting evidence from 1688 or other approved sourcing providers to estimate factory unit cost, MOQ, tiered pricing, domestic China shipping, sourcing risk, and landed cost assumptions.

Supplier order fulfillment, inventory synchronization, purchase order automation, supplier-side order automation, and warehouse or 3PL operations remain out of scope for Version 1.

These features will be implemented in future versions.

---

# 7. Functional Requirements

## FR-001

The system shall allow users to start Product Research only through an AI
Discovery Job. The job creates the independent ResearchProject and requires a
seed product plus constraints.

---

## FR-002

The system shall trigger product research independently from product creation workflows.

---

## FR-003

The system shall generate product research data.

---

## FR-003a

The system shall generate multiple product candidates from a product idea or niche.

Product candidates must be derived from collected external research evidence.
If approved research providers are unavailable or return no usable evidence, the
system shall return an empty candidate list or visible failure instead of
generating fallback candidates with AI.

---

## FR-003b

The system shall rank product candidates using a two-phase scoring model.

**Phase 1 — Discovery Scoring (market signals only):**

The system shall score candidates using only market-level factors available
before sourcing enrichment:

- demandScore (from aggregated order count, review count across providers)
- trendScore (from trend/interest signals)
- competitionScore (from competitor and saturation indicators)
- marginScore (only when landed cost or COGS data is available; must not
  estimate margin from price alone without cost data)
- creativePotentialScore (from ads signal and creative angle evidence)
- riskScore (from combined risk indicators)

Sourcing-dependent factors (supplierScore, sourcingScore, factoryCostScore,
logisticsScore) shall be excluded from Phase 1 scoring and their weights
redistributed across the active market factors.

**Phase 2 — Full Scoring (after sourcing enrichment):**

After candidate-level 1688 sourcing enrichment through
CandidateSourcingService, the system shall re-score the candidate with all
ten factors including supplier, sourcing, factory cost, and logistics scores
backed by real sourcing evidence.

The system shall use reviewer-supplied research constraints, including price
band, target margin, maximum MOQ, risk tolerance, and excluded categories, to
filter or clearly qualify provider-backed candidates before recommendation.

---

## FR-003c

The system shall persist source evidence used by the Research Agent, including source type, provider, URL or external identifier, extracted signal, confidence, capture timestamp, and raw sourcing fields when available.

---

## FR-003d

The system shall estimate selling price, factory unit cost, MOQ, tiered sourcing cost, domestic supplier shipping, international freight assumptions, payment fee, landed cost, gross profit, gross margin, and break-even ROAS for each product candidate when sufficient data is available.

1688 sourcing data must be treated as research evidence for cost and supplier discovery, not as proof that a supplier has been verified for production. Final supplier selection still requires human review or an approved sourcing verification process.

---

## FR-003e

The system shall allow reviewers to select a specific product candidate and promote it into a product creation workflow.

---

## FR-003f

The system shall not present AI-generated research conclusions as verified facts unless the conclusion is linked to source evidence or explicitly marked as an AI estimate.

---

## FR-003g

The system shall support AI-assisted source match review between product demand,
marketplace/store evidence, and sourcing evidence such as 1688 offers.

The review must:

* Use only persisted ResearchSource records and candidate metadata as input
* Return structured output with match status, confidence score, reasons,
  warnings, and recommended action
* Preserve all original source records and source URLs
* Never fabricate candidates, supplier sources, product URLs, prices, MOQ, or
  sourcing evidence
* Return `INSUFFICIENT_EVIDENCE` when the available source data cannot support
  a reliable match decision
* Require human confirmation before uncertain matches affect the final
  candidate recommendation

---

## FR-003h

The system shall support product discovery jobs that start from a required
user-entered seed product.

The job may use AI to rank or filter provider-backed derived keywords only.
Product candidates, suppliers, costs, MOQ, landed cost, source URLs, and source
evidence shall come from approved provider integrations and persisted
ResearchSource records.

---

## FR-003i

The system shall aggregate marketplace listings from multiple external providers
into unified product candidates before individual candidate creation.

This is the Product Research two-phase candidate discovery contract:

```text
Phase 1: raw provider listings -> normalized ResearchSource evidence
Phase 2: aggregated product groups -> ProductCandidate drafts
```

The Product Aggregation step must:

* Accept `MARKETPLACE` source evidence as the candidate-seeding input
* Use `SEARCH`, `TREND`, `KEYWORD`, `ADS_SIGNAL`, and `SOCIAL` as supporting
  evidence for enrichment, scoring, and confidence, not as standalone candidate
  seeds
* Exclude `SOURCING` evidence from initial candidate discovery; 1688 sourcing
  enriches an existing candidate later
* Use AI exclusively to analyze and group provider-backed listings that
  describe the same real-world product, based on product name, price cluster,
  review/order scale, and provider context
* Never fabricate product names, prices, URLs, suppliers, or source evidence
* Allow AI grouping to leave weak, noisy, broad, or unrelated marketplace
  listings unassigned; only assigned source groups seed ProductCandidate drafts
* Return no product groups and surface an empty/failed provider-backed result
  when the AI provider is unavailable, misconfigured, or returns invalid output;
  multi-source candidate grouping must not silently fall back to deterministic
  name-based deduplication
* Merge aggregated metrics per product group: demand signals (max),
  pricing (median and range), rating (average), review and order counts (sum),
  and source count (for confidence scoring)
* Preserve all original source records and source URLs in the merged candidate
  metadata for full auditability
* Return an empty candidate list when no provider evidence is available, with
  no AI-generated fallback candidates
* Avoid creating a dedicated ProductGroup database model for the initial
  implementation; aggregation results are transient service-layer outputs and
  must be persisted through ProductCandidate metadata and linked ResearchSource
  records
* Respect the configured candidate output limit instead of hardcoding the
  shortlist size

DataForSEO Merchant Google Shopping shall be the primary marketplace validation
provider for product-like discovery queries. The Research Provider layer shall
normalize Merchant product results into `MARKETPLACE` `ResearchSource`
evidence with product title, product URL or product ID, price, currency,
seller/shop signal, rating, review/vote count when available, and query
provenance.

DataForSEO Merchant evidence validates that a keyword maps to real products
being sold; it must not create ProductCandidate records directly. Merchant
listings must still flow into ProductAggregationService so duplicate or similar
listings can be grouped into unified product opportunities.

Apify-backed candidate discovery shall use the actor definitions in
`config/apify-candidate-discovery.json`. The Research Provider layer may run
the configured actors whose `providerType` is enabled by the research
configuration, normalize their dataset items into `ResearchSource` evidence,
and pass the resulting marketplace evidence into ProductAggregationService.
Apify acts as an additive marketplace evidence provider after DataForSEO
Merchant. DataForSEO Merchant runs first for baseline Google Shopping
validation; Apify then expands the same seed and selected derived queries across
configured marketplace, commerce, and ads-signal actors. Candidate discovery
must not treat Apify as a marketplace fallback that runs only when Merchant
returns no evidence.

---

## FR-003j

The system shall support provider-backed query intelligence before marketplace
candidate discovery.

Query intelligence must:

* Run approved `TREND`, `KEYWORD`, and lightweight `SEARCH` providers before
  marketplace and Apify candidate discovery
* Extract trending, rising, related, and buyer-intent keyword candidates only
  from provider responses and normalized source evidence
* Rank and filter keyword candidates by relevance to the seed query, trend
  strength, search volume, buyer intent, competition, CPC, risk, and duplicate
  similarity
* Produce a capped set of derived queries, preserving the original seed query
  as the first candidate-discovery query
* Allow AI only to rank, filter, or explain provider-backed keyword evidence;
  AI must not invent keywords that are absent from provider responses
* Pass the seed query plus selected derived queries into marketplace and Apify
  candidate-discovery providers
* Persist or embed query provenance on every downstream `ResearchSource`, such
  as `queryUsed`, `querySource`, `queryScore`, and `collectionStage`
* Return the original seed-query-only discovery path when providers return no
  usable query intelligence; it must not fall back to AI-generated keywords,
  products, URLs, prices, or evidence

---

## FR-004

The system shall generate product content.

---

## FR-005

The system shall generate SEO metadata.

---

## FR-006

The system shall generate landing page content.

---

## FR-007

The system shall generate image prompts.

---

## FR-008

The system shall create Shopify draft resources.

---

## FR-009

The system shall create a review task.

---

## FR-010

The system shall require human approval before publishing.

---

## FR-011

The system shall publish approved resources.

---

## FR-012

The system shall store all generated content.

---

## FR-013

The system shall log all agent executions.

---

## FR-014

The system shall log all workflow state changes.

---

## FR-015

The system shall require a selected product candidate before starting Content generation.

---

## FR-016

The system shall require human approval after the Content step before proceeding to SEO generation.

---

## FR-017

The system shall require human approval after the SEO step before proceeding to Landing Page generation.

---

## FR-018

The system shall require human approval after the Landing Page step before proceeding to Shopify draft creation.

---

## FR-019

The system shall allow reviewers to reject a step with feedback, triggering re-generation of that step.

---

## FR-020

The system shall provide dedicated review pages for each workflow step (Research, Content, SEO, Landing) where reviewers can view and edit generated content before approving.

---

## FR-021

The system shall persist all manual edits to generated content and track edit history.

---

## FR-022

The system shall require user authentication (email + password) before accessing any dashboard or API endpoint.

---

## FR-023

The system shall support role-based access control (Admin, Reviewer, Editor) with permissions enforced at the API layer.

---

## FR-024

The system shall issue secure, httpOnly JWT tokens for session management with configurable expiry.

---

## FR-025

The system shall provide a login page at `/login` and redirect unauthenticated users to it.

---

# 8. Non-Functional Requirements

## NFR-001 Performance

The system should complete a product workflow in less than 5 minutes under normal conditions.

---

## NFR-002 Scalability

The system should support at least:

* 1000 products
* 100 concurrent workflows

---

## NFR-003 Reliability

Failed jobs must automatically retry.

Retry Count:

```text
3
```

Retry Strategy:

```text
Exponential Backoff
```

---

## NFR-004 Security

Secrets must never be hardcoded.

All credentials must be stored in environment variables.

---

## NFR-005 Auditability

All workflow actions must be logged.

---

## NFR-006 Maintainability

Business logic must be separated from infrastructure code.

---

# 9. Workflow

## Product Discovery and Creation Flow

```text
Product Idea
      ↓

Research Agent
      ↓

Research Product Intelligence Module
      ↓

Ranked Product Candidate Selection
      ↓

Promote Candidate to Product
      ↓

Content Agent
      ↓

SEO Agent
      ↓

Landing Agent
      ↓

Image Agent
      ↓

Shopify Agent
      ↓

Review Agent
      ↓

Human Approval
      ↓

Publish Agent
```

---

# 10. Agents

## Research Agent

Responsibilities:

* Product candidate discovery
* Market research
* Competitor analysis
* Persona generation
* USP generation
* Source-backed evidence collection through Research Provider interfaces
* Candidate scoring and recommendation
* Factory sourcing, landed cost, margin, and pricing feasibility analysis
* Risk flag generation

The Research Agent must not directly access external APIs, Prisma, Redis, Shopify APIs, or provider SDKs. It must coordinate through the service layer and provider interfaces. Product Research is not a mandatory Workflow step; it is a discovery workspace that produces candidates which can be promoted into workflows.

Research output must be structured as:

```json
{
  "summary": "Research summary for the opportunity",
  "candidates": [
    {
      "name": "Candidate product name",
      "positioning": "Primary market position",
      "targetMarket": "US",
      "sellingAngle": "Main sales angle",
      "recommendedPrice": 89.99,
      "estimatedCOGS": 38,
      "estimatedShipping": 9,
      "landedCostBreakdown": {
        "factoryUnitCost": 22,
        "moq": 100,
        "domesticChinaShipping": 2.5,
        "internationalFreightEstimate": 8,
        "agentFeeEstimate": 2,
        "customsDutyEstimate": 1.5,
        "packagingEstimate": 2
      },
      "grossMarginPercent": 47.8,
      "winningScore": 82,
      "confidence": "medium",
      "scores": {
        "demand": 85,
        "trend": 78,
        "competition": 62,
        "margin": 88,
        "sourcing": 74,
        "factoryCost": 82,
        "logistics": 70,
        "creativePotential": 81,
        "risk": 35
      },
      "risks": [],
      "evidence": []
    }
  ],
  "recommendation": {
    "decision": "APPROVE",
    "bestCandidateId": "candidate-id",
    "reason": "Strong demand, acceptable competition, and healthy margin"
  }
}
```

---

## Content Agent

Responsibilities:

* Product content generation
* FAQ generation
* CTA generation

---

## SEO Agent

Responsibilities:

* SEO title
* SEO description
* Keywords
* Slug generation

---

## Landing Agent

Responsibilities:

* Landing page structure
* Landing page content

---

## Image Agent

Responsibilities:

* Image prompt generation

---

## Shopify Agent

Responsibilities:

* Shopify resource creation
* Shopify synchronization

---

## Review Agent

Responsibilities:

* Content validation
* Review preparation

---

## Publish Agent

Responsibilities:

* Resource publishing

---

# 11. Human Approval Rules

Publishing is forbidden unless the workflow status is:

```text
APPROVED
```

The reviewer may:

```text
Approve

Reject

Request Changes
```

All decisions must be recorded.

---

# 12. Success Metrics

## Product Workflow Completion

Target:

```text
> 95%
```

---

## Publishing Accuracy

Target:

```text
> 99%
```

---

## Manual Effort

Target:

```text
< 10 minutes per product
```

---

## Workflow Duration

Target:

```text
< 5 minutes
```

---

# 13. Future Roadmap

## Version 2

* Supplier Procurement Integration
* Inventory Synchronization
* Pricing Agent
* Ads Agent

---

## Version 3

* Customer Support Agent
* Analytics Agent
* Automated Growth Agent

---

# 14. Acceptance Criteria

The project is considered successful when:

1. User submits a product idea.
2. The system automatically generates all required content.
3. Shopify draft resources are created.
4. Human review is completed.
5. Approved resources are published.
6. All workflow activities are logged.
7. The process requires less than 10 minutes of manual work.

```
```
