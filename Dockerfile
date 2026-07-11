# syntax=docker/dockerfile:1

# ---- deps: install dependencies with a cached, reproducible lockfile install ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the Next.js standalone build ----
# No ELASTICSEARCH_* / build args needed here — the app has no NEXT_PUBLIC_* vars,
# so nothing Elasticsearch-related is baked in at build time (see lib/es.ts).
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# git doesn't materialize empty directories, so a public/ with no tracked files
# won't exist after checkout — ensure it's there for the runner stage's COPY below.
RUN mkdir -p ./public
RUN npm run build

# ---- runner: minimal runtime image using the standalone server ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `output: "standalone"` (next.config.ts) produces a self-contained server.js plus a
# pruned node_modules; static assets and /public must be copied in separately.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080

CMD ["node", "server.js"]
