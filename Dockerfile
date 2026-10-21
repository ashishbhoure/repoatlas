# syntax=docker/dockerfile:1
# Multi-stage build for RepoAtlas (Next.js standalone output).
#   docker build -t repoatlas .                     -> runtime image
#   docker build --target migrate -t repoatlas-migrate .  -> one-off migration image

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
# Only used so `prisma generate` (postinstall) can load the config; never used to connect.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm install --frozen-lockfile

FROM base AS build
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate && pnpm build

# Runs `prisma migrate deploy` against $DATABASE_URL, then exits.
FROM base AS migrate
COPY --from=deps /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
