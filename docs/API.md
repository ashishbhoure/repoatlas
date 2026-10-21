# HTTP API

All endpoints return JSON. Errors use one shape:

```json
{ "error": { "code": "UPSTREAM_RATE_LIMITED", "message": "Human-readable, safe message", "retryAfter": 42 } }
```

| Code | Status | Meaning |
| --- | --- | --- |
| `INVALID_INPUT` | 400 | Validation failed (message says which field) |
| `UNAUTHENTICATED` | 401 | Sign in required / bad cron secret |
| `FORBIDDEN` | 403 | Cross-origin mutation |
| `NOT_FOUND` | 404 | Unknown repository / resource not owned by you |
| `CONFLICT` | 409 | Duplicate name or a limit was reached |
| `UPSTREAM_INVALID_QUERY` | 422 | GitHub rejected the search |
| `RATE_LIMITED` | 429 | RepoAtlas's own rate limit (`Retry-After` header set) |
| `FEATURE_DISABLED` | 501 | Integration not configured |
| `UPSTREAM_UNAVAILABLE` / `UPSTREAM_BAD_RESPONSE` | 502 | GitHub or the AI service failed |
| `UPSTREAM_RATE_LIMITED` | 503 | GitHub's rate limit; `retryAfter` when known |

Mutations require a same-origin `Origin` header (CSRF protection) and a session cookie.

## Public

| Method & path | Description | Rate limit |
| --- | --- | --- |
| `GET /api/search` | Same parameters as `/explore` (`q`, `language`, `topic`, `license`, `minStars`, `maxStars`, `minForks`, `maxForks`, `minSize`, `maxSize`, `minGoodFirstIssues`, `created`, `createdFrom`, `createdTo`, `pushed`, `pushedFrom`, `pushedTo`, `archived`, `fork`, `sort`, `order`, `page`, `perPage`). Invalid params → 400. Returns `items`, `totalCount`, `lastPage`, `query` (native query + explanation), `freshness`. | 30/min/IP |
| `GET /api/repositories/:owner/:name` | Metadata, latest release, contributors summary, community profile, languages, weekly commits, health score, recorded history | 60/min/IP |
| `GET /api/suggest?q=` | Up to 6 repositories RepoAtlas has observed whose name contains `q` (no GitHub quota used) | 60/min/IP |
| `GET /api/health` | `{"status":"ok"}` or 503 when the database is unreachable | — |
| `POST /api/ai/interpret` | `{ "query": "…" }` → proposed `spec`, `href`, `explanation`, `unsupported`, `dropped`. Does not run the search. | 10/min/IP |

## Signed-in user

| Method & path | Body | Description |
| --- | --- | --- |
| `GET /api/saved` | — | Saved repositories |
| `POST /api/saved` | `{ fullName, note? }` | Save (idempotent; resolves the GitHub id server-side) |
| `PATCH /api/saved/:providerId` | `{ note }` | Update note |
| `DELETE /api/saved/:providerId` | — | Unsave |
| `GET /api/collections[?repo=:providerId]` | — | Collections (with `contains` flags when `repo` given) |
| `POST /api/collections` | `{ name, description? }` | Create |
| `PATCH /api/collections/:id` | `{ name?, description?, shared? }` | Rename / describe / toggle link sharing |
| `DELETE /api/collections/:id` | — | Delete |
| `POST /api/collections/:id/items` | `{ fullName, note? }` | Add repository |
| `PATCH` / `DELETE /api/collections/:id/items/:providerId` | `{ note }` / — | Note / remove |
| `GET /api/collections/:id/export?format=md\|json` | — | Download |
| `GET` / `POST /api/saved-searches` | `{ name, spec }` | List / save |
| `DELETE /api/saved-searches/:id` | — | Delete |
| `GET /api/watches[?repo=:providerId]` | — | Watches (or one) |
| `PUT /api/watches` | `{ fullName, notifyRelease, notifyArchived, starThreshold }` | Create/update a watch |
| `DELETE /api/watches/:providerId` | — | Stop watching |
| `GET /api/notifications` | — | `items`, `unread` |
| `POST /api/notifications` | `{ ids? }` | Mark given (or all) as read |
| `GET /api/me` | — | Export all account data |
| `DELETE /api/me` | — | Delete account and data |

Mutations share a 60/min/user rate limit.

## Scheduled jobs

`GET|POST /api/cron/snapshots` and `/api/cron/alerts` with `Authorization: Bearer $CRON_SECRET`.
Responses report what was processed, e.g. `{ "due": 4, "checked": 4, "notifications": 1 }`.

## Auth

`/api/auth/*` is handled by Better Auth (GitHub OAuth). Returns 501 when accounts are not configured.
