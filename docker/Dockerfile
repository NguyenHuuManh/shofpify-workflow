# =============================================================================
# Dockerfile - Shopify Autonomous Store Platform
# =============================================================================
# Multi-stage build for Next.js application.

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies required for Prisma
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci --only=production --ignore-scripts

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Runner
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl curl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

# Copy Prisma artifacts for runtime migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npx", "next", "start"]
