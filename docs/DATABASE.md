# Database

PostgreSQL 17 via Prisma 7 (`prisma/schema.prisma`, driver adapter `@prisma/adapter-pg`).
Migrations live in `prisma/migrations` and are applied with `pnpm db:migrate` (development) or
`pnpm db:deploy` / the Docker `migrate` target (production).

Public repositories are **not** mirrored into the database. Only what RepoAtlas needs is stored:
user data, observations for growth, and infrastructure tables.

## Models

| Model | Purpose | Notes |
| --- | --- | --- |
| `user`, `session`, `account`, `verification` | Better Auth tables | OAuth tokens in `account` are encrypted at rest (`encryptOAuthTokens`) |
| `SavedRepository` | A user's bookmarks | Unique `(userId, provider, providerRepoId)`; optional note |
| `Collection` | Named list owned by a user | Unique `(userId, name)`; `shareSlug` non-null only when sharing is on |
| `CollectionRepository` | Items in a collection | Unique `(collectionId, provider, providerRepoId)`; cascade on collection delete |
| `SavedSearch` | A saved `SearchSpec` (JSON) | Re-validated on read; unsupported specs are flagged, never executed |
| `RepositoryWatch` | Alert subscription + last observed baseline | Unique per user/repository; first check only records a baseline |
| `Notification` | In-app alert | Indexed by `(userId, readAt, createdAt)` |
| `TrackedRepository` | A repository RepoAtlas has observed | Unique `(provider, providerRepoId)`; `fullName` kept current after renames |
| `RepositorySnapshot` | Time-stamped stars/forks/issues | Unique `(trackedRepositoryId, observedAt)`; `observedAt` = provider fetch time |
| `CacheEntry` | Shared response cache | `freshUntil` / `expiresAt`; opportunistic cleanup |
| `RateLimitBucket` | Fixed-window counters for RepoAtlas's own API | Atomic upsert; old buckets pruned |

## Identity

Repositories are identified by GitHub's numeric id (`providerRepoId`), resolved server-side from
`owner/name`. Names are stored as display metadata only, because repositories can be renamed or
transferred. `Provider` is an enum (currently `GITHUB`) so other hosts can be added.

## Ownership and deletion

Every user-data query is scoped by `userId` inside the service layer
(`src/server/collections/library.ts`, `src/server/alerts/alerts.ts`). Deleting a user cascades to
sessions, accounts, saved repositories, collections (and items), saved searches, watches and
notifications. Deleting a collection cascades to its items.

## Retention

Snapshots are sampled at most every 6 hours per repository. There is no automatic pruning yet;
at ~4 rows/day per actively viewed repository, the table stays small for typical instances. A
retention job (e.g. thin to daily after 90 days) is on the roadmap.

## Least privilege

The application only needs `SELECT/INSERT/UPDATE/DELETE` on its tables. Use a separate role with
DDL rights for migrations (`DATABASE_URL` for the `migrate` container) and a DML-only role for
the app in production.
