# Roadmap

## Done

| Milestone | Status |
| --- | --- |
| 0. Planning: PRD, architecture | Done |
| 1. Foundation: Next.js 16, Tailwind 4, shadcn/ui, Prisma 7, env validation, layout, navigation, themes | Done |
| 2. GitHub integration: provider interface, client (retries, rate limits, ETags), normalization, caching | Done |
| 3. Search UI: Explore, filters, chips, sort, pagination, URL state, query panel, ⌘K palette, responsive | Done |
| 4. Discovery: most starred/forked, recently updated/created, trending (measured + new), hidden gems, topics, awesome lists | Done |
| 5. Intelligence: repository page, health score v1, snapshots & star history, commit activity, related, compare | Done |
| 6. User features: GitHub sign-in, saved repositories, collections (share/export), saved searches, watches & in-app alerts, settings (export/delete) | Done |
| 7. AI search: natural language → validated filters → review → regular search | Done |
| 8. Production readiness: security headers, audit, Docker, Vercel crons, tests, docs | Done |

## Next

- Email delivery for alerts (opt-in, digest), and "new repositories matching a saved search" alerts.
- Snapshot retention job (thin to daily after 90 days) and a measured-growth view per topic.
- Search history for signed-in users.
- Optional OpenSSF Scorecard signal on repository pages (security posture), shown separately from
  the health score.
- GitLab provider (`RepositoryProvider` implementation) with capability flags in the UI.
- Open Graph images for repository and comparison pages.
- Health score v2: issue response times and release regularity (needs additional API calls; to be
  cached and computed in the background).
