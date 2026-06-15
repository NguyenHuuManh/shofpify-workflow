# API DESIGN

Base URL

/api

---

# Workflow

POST /workflow/start

GET /workflow/:id

---

## Workflow — Per-Step Review (Approve / Reject)

POST /workflow/:id/review/research

POST /workflow/:id/review/content

POST /workflow/:id/review/seo

POST /workflow/:id/review/landing

POST /workflow/:id/review/final

POST /workflow/:id/approve

POST /workflow/:id/reject

---

## Workflow — Per-Step Content Fetch & Edit

Each section has its own GET (fetch generated content) and PUT (edit/save changes before approving).

GET /workflow/:id/research

PUT /workflow/:id/research

GET /workflow/:id/content

PUT /workflow/:id/content

GET /workflow/:id/seo

PUT /workflow/:id/seo

GET /workflow/:id/landing

PUT /workflow/:id/landing

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
