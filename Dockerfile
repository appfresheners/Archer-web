# syntax=docker/dockerfile:1

# ---- Stage 1: install dependencies ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Copy only manifests to maximize layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: build the app ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Stage 3: minimal runtime image ----
FROM node:22-alpine AS runner
RUN addgroup --system --gid 1001 nodejs

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0



# next build with output: "standalone" emits a pruned server bundle that
# does NOT include static assets or the public dir, so copy those explicitly.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

EXPOSE 3000

RUN mkdir -p .next/cache/fetch-cache && chown -R node:nodejs .next/cache

# Run as the built-in non-root "node" user.
USER node

CMD ["node", "server.js"]
