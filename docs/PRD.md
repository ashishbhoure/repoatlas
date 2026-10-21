# RepoAtlas — Product Requirements

## Summary

RepoAtlas is a discovery and intelligence layer over public Git repositories. Phase 1 covers
GitHub public repositories. Users search with plain keywords or structured filters, browse
curated discovery views (most starred, most forked, recently updated, hidden gems, topics,
awesome lists), inspect a repository in depth (metadata, README, health score), and compare
repositories side by side. Signed-in users keep saved repositories, collections and saved
searches.

## Principles

1. **Accuracy** — every metric shown comes from a provider API response or from an
   observation RepoAtlas recorded. Nothing is fabricated.
2. **Transparency** — derived scores (health, hidden-gem, popularity/activity) show their
   inputs, weights, algorithm version and data freshness.
3. **Honest labels** — "Trending"/"fastest growing" are only used for growth that was
   actually measured between two snapshots. Without history, views are labelled
   "Popular & recently active".
4. **Anonymous first** — exploring needs no account. Accounts are only for persistence.

## Users

Developers evaluating libraries, open-source contributors, students, researchers,
engineering teams, security researchers.

## Key provider constraints (GitHub)

| Constraint | Consequence in the product |
| --- | --- |
| Search API: 30 req/min authenticated, 10 req/min anonymous | Aggressive response caching; server token required for usable throughput |
| Search API returns at most 1,000 results per query | Pagination stops at page 1000/perPage; UI says so |
| Search qualifiers cover stars, forks, size, language, topic, license, created, pushed, archived, fork, user/org, is:public | These filters are "provider-native" |
| Contributor counts, releases, commit activity are not search qualifiers | Only shown on details/compare pages, never as search filters that pretend to be global |
| GraphQL requires a token | Details use REST so anonymous dev mode still works |
| No trending API | RepoAtlas records snapshots and computes growth itself |

## MVP scope (this milestone)

- Global layout, navigation, theme switching, responsive design.
- GitHub provider adapter with normalization, caching, rate-limit tracking, error mapping.
- Explore: keyword search + advanced filters, URL-synchronized, chips, sort, pagination,
  query transparency panel.
- Discovery pages: Most Starred, Most Forked, Recently Updated, Recently Created,
  Popular & Active (trending-until-history), Hidden Gems, Topics, Awesome Lists.
- Repository details: metadata, latest release, languages, contributors (top), README
  (sanitized), health score v1 with methodology, snapshot history when available.
- Compare: 2–4 repositories, table + chart, shareable URL.
- Snapshot collection: a repository snapshot is recorded (at most once per 6 h) whenever
  details are fetched, plus a cron endpoint that snapshots tracked repositories.

## Delivered beyond the MVP

1. Authentication (GitHub OAuth via Better Auth), saved repositories, collections, saved
   searches, account export/deletion.
2. Watches with in-app alerts (new release, star milestone, archived), checked by a cron job.
3. AI search: natural language → validated `SearchSpec` → user review → the same search service.
4. Measured trending, shown as soon as two observations ≥ 20 h apart exist.

## Still planned

See `docs/ROADMAP.md` (email alerts, more providers, health score v2, …).

## Acceptance criteria (MVP)

See `docs/ROADMAP.md` for the per-milestone checklist. The MVP is accepted when the
Definition of Done in the master prompt items 1–20 hold for the MVP scope above.
