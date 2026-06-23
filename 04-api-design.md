# API DESIGN

Base URL

/api

---

# Authentication

All `/api/*` endpoints (except `/api/auth/*`) and `/dashboard/*` pages require
a valid JWT token sent as an httpOnly cookie (`auth_token`).

Unauthenticated requests receive `401 Unauthorized`.

---

## POST /api/auth/login

Authenticates a user and sets the `auth_token` httpOnly cookie.

Request:

```json
{
  "email": "admin@shopify-autonomous.com",
  "password": "secure-password"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "admin@shopify-autonomous.com",
      "name": "Platform Admin",
      "role": "ADMIN"
    }
  }
}
```

Errors: `401` invalid credentials, `400` validation error.

---

## POST /api/auth/register

Creates a new user. Restricted to ADMIN role.

Request:

```json
{
  "email": "editor@shopify-autonomous.com",
  "name": "Content Editor",
  "password": "secure-password",
  "role": "EDITOR"
}
```

Response: `201 Created` with user object (without passwordHash).

Errors: `409` email already exists, `403` forbidden (non-admin).

---

## POST /api/auth/logout

Clears the `auth_token` cookie.

Response: `200 OK`

---

## GET /api/auth/me

Returns the currently authenticated user from the JWT token.

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "admin@shopify-autonomous.com",
      "name": "Platform Admin",
      "role": "ADMIN"
    }
  }
}
```

Errors: `401` no valid token.

---

# Workflow

POST /workflow/start

GET /workflow/:id

Workflows start after a ProductCandidate has been selected or a Product already exists. Product Research is exposed through `/product-research` APIs.

---

## Workflow — Per-Step Review (Approve / Reject)

POST /workflow/:id/review/content

POST /workflow/:id/review/seo

POST /workflow/:id/review/landing

POST /workflow/:id/review/final

POST /workflow/:id/approve

POST /workflow/:id/reject

---

## Workflow — Per-Step Content Fetch & Edit

Each section has its own GET (fetch generated content) and PUT (edit/save changes before approving).

GET /workflow/:id/content

PUT /workflow/:id/content

GET /workflow/:id/seo

PUT /workflow/:id/seo

GET /workflow/:id/landing

PUT /workflow/:id/landing

---

## Product Research

### POST /product-research

Creates a product research project and runs the Research Product Intelligence Module.
The same configuration is used by the dashboard Product Research form. Brief
constraints are applied to provider-backed candidates after evidence collection;
they do not enable AI-generated fallback candidates.

Request:

```json
{
  "query": "portable kitchen gadgets",
  "targetMarket": "US",
  "priceBand": {
    "min": 30,
    "max": 120
  },
  "targetMarginPercent": 40,
  "riskTolerance": "medium",
  "excludedCategories": ["regulated", "fragile"],
  "objective": "find_winning_product",
  "sourcing": {
    "targetSource": "1688",
    "targetCurrency": "USD",
    "maxMoq": 500,
    "landedCostAssumptions": {
      "agentFeePercent": 8,
      "internationalFreightPerUnit": 8,
      "customsDutyPercent": 5,
      "packagingPerUnit": 1.5,
      "qcPerUnit": 0.75
    }
  }
}
```

Response:

```json
{
  "researchProjectId": "research-project-id",
  "researchRunId": "research-run-id",
  "status": "COMPLETED"
}
```

---

### GET /product-research

Returns research projects with latest candidate summary.

---

### GET /product-research/:projectId/candidates

Returns ranked product candidates for the latest research run.
Dashboard clients may use this response together with
`GET /product-research/:projectId/sources` to render candidate comparison
snapshots, evidence counts, and evidence-type mixes.

Response:

```json
{
  "researchRunId": "research-run-id",
  "candidates": [
    {
      "id": "candidate-id",
      "name": "Product candidate",
      "positioning": "Market positioning",
      "targetMarket": "US",
      "recommendedPrice": 89.99,
      "estimatedCOGS": 38,
      "estimatedShipping": 9,
      "factoryUnitCost": 22,
      "moq": 100,
      "landedCost": 37,
      "landedCostBreakdown": {
        "factoryUnitCost": 22,
        "tieredPrices": [
          { "minQuantity": 2, "unitCost": 25 },
          { "minQuantity": 100, "unitCost": 22 },
          { "minQuantity": 500, "unitCost": 19 }
        ],
        "domesticChinaShipping": 2.5,
        "internationalFreightEstimate": 8,
        "agentFeeEstimate": 2,
        "customsDutyEstimate": 1.5,
        "packagingEstimate": 1.5,
        "qcEstimate": 0.75,
        "assumptions": ["international freight estimated from default config"]
      },
      "grossMarginPercent": 47.8,
      "breakEvenRoas": 2.25,
      "winningScore": 82,
      "confidence": "medium",
      "scores": {
        "demand": 85,
        "trend": 78,
        "competition": 62,
        "margin": 88,
        "supplier": 74,
        "sourcing": 78,
        "factoryCost": 82,
        "logistics": 70,
        "creativePotential": 81,
        "risk": 35
      },
      "risks": []
    }
  ]
}
```

---

### GET /product-research/candidates/:candidateId

Returns full candidate detail, including cost analysis, landed cost breakdown, competitor summary, sourcing summary, risk flags, and linked source evidence.

---

### POST /product-research/candidates/:candidateId/select

Selects the candidate for a research project.

Request:

```json
{
  "reviewerId": "user-id",
  "comment": "Best balance of demand, margin, and creative angles"
}
```

Response:

```json
{
  "selectedCandidateId": "candidate-id"
}
```

---

### POST /product-research/candidates/:candidateId/source-matches/review

Runs AI-assisted source match review for a candidate using persisted source
evidence only. This endpoint is planned for the Product Research source matching
upgrade and must not generate candidates or source evidence.

Request:

```json
{
  "sourceIds": ["source-id-a", "source-id-b"],
  "reviewerMode": "draft"
}
```

Response:

```json
{
  "matches": [
    {
      "sourceId": "marketplace-source-id",
      "matchedSourceId": "sourcing-source-id",
      "matchStatus": "POTENTIAL_MATCH",
      "confidenceScore": 82,
      "reasons": ["similar product function", "compatible price and MOQ"],
      "warnings": ["image comparison unavailable"],
      "recommendedAction": "REVIEW_BEFORE_LINKING"
    }
  ]
}
```

Errors: `404` candidate or source not found, `400` validation error,
`422` insufficient persisted evidence for review.

---

### POST /product-research/candidates/:candidateId/source-matches/:matchId/decision

Persists a human decision for an AI-assisted source match result.

Request:

```json
{
  "decision": "CONFIRMED_MATCH",
  "reviewerId": "user-id",
  "comment": "Same product form factor and specs; acceptable sourcing match."
}
```

Allowed decisions:

```text
CONFIRMED_MATCH
REJECTED_MATCH
NEEDS_BETTER_SOURCE
```

Response:

```json
{
  "matchId": "match-id",
  "decision": "CONFIRMED_MATCH"
}
```

---

### POST /product-research/candidates/:candidateId/promote

Promotes a selected candidate into a Product and starts the production workflow at Content.

Request:

```json
{
  "reviewerId": "user-id",
  "comment": "Ready for content generation"
}
```

Response:

```json
{
  "productId": "product-id",
  "workflowId": "workflow-id"
}
```

---

### GET /product-research/:projectId/sources

Returns normalized source evidence collected during research.

Response:

```json
{
  "sources": [
    {
      "id": "source-id",
      "type": "SOURCING",
      "provider": "1688",
      "url": "https://detail.1688.com/offer/example.html",
      "externalId": "1688-offer-id",
      "title": "Factory product listing",
      "extractedSignal": "1688 offer with MOQ 100, tiered unit cost from 22 USD equivalent, supplier located in Guangdong",
      "rawData": {
        "sourcePlatform": "1688",
        "offerId": "1688-offer-id",
        "shopName": "Example Factory",
        "moq": 100,
        "tieredPrices": [
          { "minQuantity": 2, "unitCost": 25 },
          { "minQuantity": 100, "unitCost": 22 }
        ],
        "domesticChinaShipping": 2.5,
        "metrics": {
          "productCost": 22,
          "shippingCost": 2.5,
          "sourcingSignal": 78,
          "factoryCostSignal": 82,
          "logisticsSignal": 70
        }
      },
      "confidence": 0.72,
      "capturedAt": "2026-06-16T00:00:00.000Z"
    }
  ]
}
```

---

# Product

GET /products

GET /products/:id

POST /products

PUT /products/:id

DELETE /products/:id

---

# Review

GET /reviews

POST /reviews/:id/approve

POST /reviews/:id/reject

---

# Assets

POST /assets/upload

GET /assets/:id

---

# Monitoring

GET /agents/status

GET /agents/logs

GET /metrics

```
```
