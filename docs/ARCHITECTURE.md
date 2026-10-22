# Architecture

RepoAtlas is a single Next.js 16 application. Pages are server components; business logic lives
in server-side services under `src/server`, so route handlers and pages stay thin and a separate
backend (e.g. NestJS) could take over the services later without frontend changes.

```
Browser ──► Next.js pages (RSC, Partial Prerendering) ─┐
        └─► Route handlers /api/*  ────────────────────┤
                                                        ▼
                         src/server  (services: search, details, ranking, library, alerts, ai)
                                │                         │
                 RepositoryProvider interface          Prisma ─► PostgreSQL
                                │                    (users, library, snapshots,
                     GitHubProvider ─► GitHubClient   cache, rate limits)
                                         │
                         cachedFetch (memory L1 + Postgres L2, ETag revalidation)
                                         │
                                  api.github.com
```

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Pages & layout | `src/app`, `src/components` | Rendering only. Static shell + `<Suspense>` for request-time data |
| Feature helpers | `src/features/*` | Pure UI-facing logic (filter chips, compare param parsing, exports, discovery resolution) |
| Route handlers | `src/app/api/*` | Validation (Zod), auth/CSRF/rate-limit guards, call a service, consistent error JSON |
| Services | `src/server/*` | Search, repository overview, ranking, snapshots/growth, library, alerts, AI interpretation |
| Providers | `src/server/providers` | `RepositoryProvider` contract; `github/` is the only implementation |
| Infrastructure | `src/lib/*` | Cache, errors, logging, rate limiting, auth, validation, sanitizing, formatting |
| Config | `src/config` | Validated environment, filter options, discovery views, topic categories |

## Key design decisions

- **One validated `SearchSpec`.** URL params, saved searches and AI output all become a
  `SearchSpec` (Zod) and run through `searchRepositories()`. Invalid URL params are dropped *and
  reported* to the user.
- **Provider isolation.** Everything GitHub-specific (query syntax, endpoints, response schemas,
  rate-limit headers) is in `src/server/providers/github`. A GitLab adapter would implement the
  same `RepositoryProvider` interface and declare its `capabilities`.
- **Caching.** `cachedFetch` is a stale-while-revalidate read-through cache keyed by a hash of
  path + query + accept header. Fresh entries are served directly; stale entries are revalidated
  with `If-None-Match` (304s cost no REST quota); if GitHub is rate-limited or down, an unexpired
  stale copy is served and labelled. L1 is a bounded per-process LRU, L2 is the shared
  `CacheEntry` table, so serverless instances share results. Only public provider data is cached.
- **Request-time vs static.** Cache Components is on. Static shells contain layout and fallbacks;
  anything that reads the session, search params, the clock or live data runs at request time
  (`connection()`, `requestNow()`), so configuration is never baked in at build time.
- **Observations, not estimates.** Every search result and repository view records a snapshot
  (at most every 6 h per repository) after the response is sent (`after()`); a cron job refreshes
  the oldest tracked repositories. Growth is computed only from these rows.
- **Honest labels.** Discovery views state their method; derived scores carry a version and a
  breakdown; sample-based aggregates name their sample.

## Request flow: a search

1. `/explore?q=…` page renders its static shell; `ExploreContent` awaits `searchParams`.
2. `parseSearchParams` validates into a `SearchSpec` and collects issues.
3. `searchRepositories(spec)` → `GitHubProvider.search` → `buildGitHubQuery` → `GitHubClient.get`.
4. `cachedFetch` serves/revalidates; the response is validated with Zod and normalized.
5. Results render as rows; snapshot recording runs after the response.

## Background work

| Job | Route | Schedule (.github/workflows/cron.yml) | Batch |
| --- | --- | --- | --- |
| Snapshot refresh | `/api/cron/snapshots` | every 6 h | 50 (10 without token) |
| Alert checks | `/api/cron/alerts` | every 3 h | 60 watches (10 without token) |

Both require `Authorization: Bearer $CRON_SECRET`. Redis/BullMQ were not needed: jobs are
bounded, idempotent and stateless between runs.

## Error handling

All service errors are `AppError` with a code, HTTP status and safe user message. Route handlers
return `{ "error": { "code", "message", "retryAfter?" } }`. Server components render
`ErrorState` with a retry link. Next.js control-flow errors (`notFound`, `redirect`, prerender
bail-outs) are always rethrown (`caught()` / `rethrowFrameworkErrors()`). Logs are JSON lines with
secret-like keys redacted.
