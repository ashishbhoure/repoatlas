# Rankings and scores

Facts (stars, forks, issues, dates, licenses…) come from GitHub. Everything below is derived by
RepoAtlas, versioned, and shown with its inputs. Code: `src/server/ranking`, `src/server/analytics`.
The in-app page `/methodology` renders the same specification from the live constants.

## Health score (`health@1`)

0–100 summary of public maintenance and community signals. Each dimension maps data to 0–1.

| Dimension | Weight | Source | Scoring | Missing data |
| --- | --- | --- | --- | --- |
| Maintenance | 25 | `pushed_at` | 1 if ≤ 14 days, linear to 0 at 365; archived → 0 | excluded |
| Commit activity | 15 | `/stats/commit_activity` | commits in last 12 weeks, `log10(1+n)/log10(121)` | excluded (GitHub may still be computing) |
| Release cadence | 10 | `/releases/latest` | 1 if ≤ 90 days, linear to 0 at 730 | **no releases → not scored** (not penalised) |
| Community adoption | 20 | stars, forks | `0.7·min(1, log10(stars+1)/5) + 0.3·min(1, log10(forks+1)/4)` | always available |
| Docs & community files | 15 | `/community/profile` | README .3, contributing .2, issue template .15, description .15, PR template .1, code of conduct .1 | excluded |
| License clarity | 10 | license | SPDX 1 · unrecognised 0.5 · none 0 | — |
| Contributors | 5 | `/contributors` (max 100) | `log10(n)/2`, capped | excluded (GitHub omits huge repos) |

- Score = weighted mean over dimensions **with data**; coverage = their share of total weight.
- Coverage < 60% → **provisional**; < 40% → **no score** ("not enough data").
- Raw open-issue counts are intentionally not used: they scale with popularity.
- Not a GitHub metric; not an assessment of code quality or security.
- Tests: `tests/unit/ranking.test.ts`.

## Hidden gems (`hidden-gems@1`)

Candidates (GitHub query): 20–1,500 stars, pushed in the last 30 days, created more than 30 days
ago, not a fork, not archived, sorted by `updated`, first 50. Then ranked locally:

| Factor | Weight | Scoring |
| --- | --- | --- |
| Recent maintenance | 35% | `0.5^(days since push / 21)` |
| Hands-on engagement | 25% | forks/stars, full at 0.25 |
| Presentation | 20% | description .4, recognised license .2, ≥3 topics .2, homepage .2 |
| Measured momentum | 20% | stars/day from snapshots, `log10(1+7·spd)/2`; excluded when unmeasured |

Star count is a filter, never an input. The list describes the candidate set only.

## Trending

- **Measured growth** (`/trending`, default): for each tracked repository, first and last
  snapshot inside the window (24 h / 7 d / 30 d); only spans ≥ 20 hours; ranked by stars/day.
  Shown with the observation dates and star counts. Empty until two observations exist.
- **New and notable**: repositories created in the last 7/30/90 days, ordered by stars — labelled
  as early attention, not growth.

The words "trending" / "fastest growing" are only used for measured growth.

## Snapshots

`recordSnapshots` stores `{stars, forks, openIssues, observedAt}` for repositories seen in search
results or detail pages (after the response), at most every 6 hours per repository, plus the
`/api/cron/snapshots` refresh of the oldest tracked repositories. `observedAt` is the time the
data was fetched from GitHub (cached responses keep their original fetch time).

## Sample aggregates

Language and topic distributions (home, topic pages) are counts over an explicitly named sample,
e.g. "the 50 most-starred repositories", never GitHub-wide totals.

## Related repositories

Most-starred repositories sharing the first topic (plus a second topic as a keyword), or the same
language when the repository has no topics. Labelled "shared tags suggest similar purpose; not
verified alternatives".
