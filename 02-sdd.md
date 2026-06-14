# SYSTEM DESIGN DOCUMENT

## Architecture

Next.js Fullstack

---

## Core Services

Frontend

Dashboard

Review Center

Agent Monitoring

Workflow Manager

---

## Backend

Route Handlers

Server Actions

BullMQ Workers

LangGraph

---

## Infrastructure

Nginx

Next.js

PostgreSQL

Redis

Worker

---

## Sequence

Create Product

↓

Workflow Service

↓

Research Agent

↓

Content Agent

↓

SEO Agent

↓

Landing Agent

↓

Shopify Agent

↓

Review Queue

↓

Approval

↓

Publish

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
