# TASK EXECUTION PLAN

Status: Final current handoff
Last consolidated: 2026-06-27

This file is the current operational source of truth for future sessions. It
intentionally replaces the older phase-by-phase history with the final Product
Research contract and the remaining execution checklist.

---

## Current Product Research Contract

Product Research has one user-facing start path:

```text
Dashboard / API
    -> DiscoveryJobService.start()
    -> enqueueProductDiscoveryJob()
    -> BullMQ research-queue
    -> product-discovery-job worker
    -> DiscoveryJobService.runJob()
    -> ResearchService.run() for each planned query
    -> Provider-backed candidates
```

Direct product-brief research runs are no longer supported as a dashboard or
public API start path. `ResearchService.run()` remains an internal service-layer
execution primitive used by the discovery job worker.

Canonical start endpoint:

```text
POST /api/product-research/discovery-jobs
```

Disabled direct-start endpoints:

```text
POST /api/product-research
POST /api/workflows/:id/research/run
```

---

## Final Research Pipeline

```text
User seed product + discovery constraints
    ↓
DataForSEO Labs keyword suggestions / trend / keyword / lightweight search query intelligence
    ↓
QueryIntelligenceService.selectQueries()
    ↓
Seed query + capped provider-backed derived queries
    ↓
DataForSEO Merchant Google Shopping first-pass marketplace validation
    ↓
Additive Apify marketplace actors for selected queries
    ↓
Normalized MARKETPLACE ResearchSource evidence
    ↓
ProductAggregationService.aggregate()
    ↓
ProductCandidate drafts
    ↓
CandidateScoringService.scoreDiscovery()
    ↓
Candidate review / selection
    ↓
CandidateSourcingService.enrichCandidate() for 1688 sourcing
    ↓
CandidateScoringService.score() full scoring
    ↓
SourceMatchingService source review
    ↓
promoteCandidate() creates Product and starts Workflow at Content
```

Provider-empty outcomes must produce an empty shortlist or visible failure.
Never generate AI fallback products, suppliers, prices, URLs, MOQ, costs, or
source evidence.

### Temporary Discovery Walkthrough Note

Current local walkthrough status:
- DataForSEO + Apify additive discovery is implemented, but the combined
  discovery behavior still needs validation before treating it as stable.
- For the current discovery-candidate walkthrough, the local `.env` may
  intentionally comment out `APIFY_CANDIDATE_DISCOVERY_API_TOKEN`,
  `APIFY_CANDIDATE_DISCOVERY_ENDPOINT`, and
  `APIFY_CANDIDATE_DISCOVERY_CONFIG_PATH`.
- With those variables commented, initial discovery should proceed through
  DataForSEO-backed query intelligence and Merchant marketplace evidence only;
  Apify candidate discovery is expected to be skipped as unconfigured.
- This is a temporary debugging posture, not a product decision to remove
  additive Apify marketplace discovery.
- `SOURCING_1688_APIFY_*` remains a separate 1688 sourcing backup config and
  must not be used as a substitute for `APIFY_CANDIDATE_DISCOVERY_*`.

---

## Implemented Modules

- Authentication and protected dashboard/API routes.
- Workflow services, worker queues, review gates, and content/SEO/landing flows.
- Independent Product Research workspace.
- AI Discovery Job service, repository, API route, dashboard form, and BullMQ
  job processing.
- Provider-backed query intelligence from DataForSEO Labs, keyword, trend, and
  lightweight search evidence.
- DataForSEO Merchant Google Shopping first-pass marketplace validation.
- Additive Apify candidate discovery provider driven by
  `config/apify-candidate-discovery.json`.
- ProductAggregationService for MARKETPLACE evidence grouping.
- Two-phase candidate scoring.
- Candidate-level 1688 sourcing enrichment with DajiSaaS primary and Apify
  backup.
- AI-assisted source match review stored in candidate metadata.
- Candidate selection and promotion into production workflow.

---

## Current UI Surface

Product Research dashboard:

```text
/dashboard/product-research
```

It must expose:

- AI Discovery Job form only.
- Discovery job status table.
- Research project list created by discovery jobs.
- Candidate detail/review pages.
- Candidate select and promote actions.
- Candidate-level 1688 sourcing enrichment.
- Source match review actions.

It must not expose:

- A separate direct Product Research form.
- Any dashboard action that calls `ResearchService.run()` directly.

---

## Current API Surface

Keep:

```text
GET  /api/product-research
POST /api/product-research/discovery-jobs
GET  /api/product-research/discovery-jobs
GET  /api/product-research/:projectId/candidates
GET  /api/product-research/:projectId/sources
GET  /api/product-research/candidates/:candidateId
POST /api/product-research/candidates/:candidateId/sourcing
POST /api/product-research/candidates/:candidateId/select
POST /api/product-research/candidates/:candidateId/promote
POST /api/product-research/candidates/:candidateId/source-matches/review
POST /api/product-research/candidates/:candidateId/source-matches/:matchId/decision
```

Disable or keep disabled:

```text
POST /api/product-research
POST /api/workflows/:id/research/run
```

---

## Architecture Guardrails

- API Route / Server Action -> Service -> Repository -> Prisma.
- Agent -> Service -> Provider -> External API.
- Repositories perform database reads/writes only.
- API routes, UI, agents, workflow nodes, and repositories must not call
  DataForSEO, Apify, DajiSaaS, 1688, Shopify, Prisma, or AI providers directly
  outside their approved layer.
- AI may plan, rank, filter, explain, or group provider-backed evidence only.
  AI must not fabricate products, keywords absent from provider evidence,
  suppliers, source URLs, prices, MOQ, factory costs, landed costs, or
  marketplace evidence.
- Initial candidate creation uses `MARKETPLACE` evidence only.
- `SOURCING` evidence enriches an existing ProductCandidate only.
- 1688 sourcing is research evidence, not fulfillment automation.
- Shopify operations go through `src/services/shopify/`.

---

## Data And Persistence Contract

Primary Product Research records:

- `ResearchProject`
- `ResearchDiscoveryJob`
- `ResearchRun`
- `ProductCandidate`
- `ResearchSource`
- `SourcingVerification`

No `ProductGroup` model exists. Product aggregation groups are transient
service-layer results persisted through `ProductCandidate.metadata.aggregation`
and linked `ResearchSource` records.

No first-class `ResearchSourceMatch` model exists. Source match review results
are stored in `ProductCandidate.metadata.sourceMatches` until reporting or
querying requirements justify a dedicated migration.

Query intelligence has no first-class table. Persist auditability in
`ResearchRun.input`, `ResearchSource.rawData`, and candidate aggregation
metadata.

---

## Required Reading For Future Sessions

Before making Product Research changes, read in this order:

1. `.github/skills/task-execution/SKILL.md`
2. `01-prd.md`
3. `02-sdd.md`
4. `03-ddd.md`
5. `04-api-design.md`
6. `05-engineering-standards.md`
7. `06-deepseek.md`
8. `07-task-execution.md`

For code changes, inspect the relevant current implementation:

- `src/services/discovery-job.service.ts`
- `src/services/research.service.ts`
- `src/services/product-aggregation.service.ts`
- `src/services/candidate-scoring.service.ts`
- `src/services/candidate-sourcing.service.ts`
- `src/services/source-matching.service.ts`
- `src/providers/research/index.ts`
- `src/providers/research/dataforseo-labs-discovery.provider.ts`
- `src/providers/research/dataforseo-merchant.provider.ts`
- `src/providers/research/keyword.provider.ts`
- `src/providers/research/sourcing-1688.provider.ts`
- `src/app/dashboard/product-research/page.tsx`
- `src/components/dashboard/research-form.tsx`
- `src/app/api/product-research/discovery-jobs/route.ts`

---

## Verification Baseline

Use the narrowest verification that matches the change. For Product Research
changes, prefer:

```bash
npm run type-check
npx prisma validate
git diff --check
npx -p node@20 node ./node_modules/vitest/vitest.mjs run tests/services/discovery-job.service.test.ts tests/services/research.service.test.ts tests/services/query-intelligence.service.test.ts
```

The local default Node may be too old for Vitest. Use Node 20 with `npx -p
node@20 ...` when Vite/Vitest fails with `crypto.getRandomValues`.

---

## Remaining Work

Production readiness remains the next major phase:

- Start required worker processes in local/dev/prod (`npm run worker`).
- Run live low-cost smoke tests for DataForSEO Merchant and, separately,
  candidate-level 1688 sourcing once provider quotas are confirmed.
- Add deployment docs for Docker, Docker Compose, Nginx, environment variables,
  Redis, PostgreSQL, Next.js, and worker processes.
- Add monitoring/alerting for failed discovery jobs and provider-empty outcomes.

Approval gate:

- Do not make large architecture, database, provider, or workflow changes
  without first presenting the implementation plan for review.
