# Testing

| Suite | Command | Tooling | What it covers |
| --- | --- | --- | --- |
| Unit | `pnpm test` | Vitest (node) | search spec parsing/serialization, query building, cache keys & SWR behaviour, ranking & health scores, sanitizer, filter chips, compare parsing, open-redirect guard, formatting, exports, AI output mapping, alert evaluation |
| Integration | `pnpm test` | Vitest + MSW + PostgreSQL | GitHub adapter against mocked HTTP (errors, retries, rate limits, ETags, 202/404), library and alerts services against the `repoatlas_test` database (ownership, uniqueness, cascades, concurrency), snapshots & growth SQL, rate limiter, Postgres cache |
| Component | `pnpm test` | Vitest (jsdom) + Testing Library | save button (optimistic + rollback), filter panel (apply, validation, locked keys) |
| End-to-end | `pnpm build && pnpm test:e2e` | Playwright (desktop Chrome + Pixel 7) | home, search, filters, sort, pagination, details, README sanitization, invalid params, empty and rate-limit states, not-found, compare, theme persistence, discovery labels, sign-in redirect, CSRF/anonymous rejection, saved repositories, collections, saved searches, watches, cron auth, mobile layout |

Current results (2026-10-22): **134 Vitest tests passing, 23 Playwright tests passing.**

## Test data

- Integration tests use `postgresql://repoatlas:repoatlas@localhost:5433/repoatlas_test`
  (override with `TEST_DATABASE_URL`). It is created and migrated automatically
  (`tests/setup/global-db.ts`). Database tests are skipped with a warning if PostgreSQL is down.
- E2E runs `next start` with `GITHUB_API_URL` pointed at `tests/e2e/mock-github.mjs`, a
  deterministic stand-in for the GitHub REST API. No live quota is used. Signed-in tests create a
  user + session row and Better Auth's signed cookie (`tests/e2e/auth.ts`), so session validation
  runs for real; the GitHub OAuth redirect itself is not exercised (it needs GitHub).
- The live API is never called by automated tests. Manual verification against the real API was
  done during development (search semantics for repeated qualifiers, README HTML structure).

## Quality gate

`pnpm check` runs lint, typecheck, Vitest and the production build. Run `pnpm test:e2e` after a
build before releasing.
