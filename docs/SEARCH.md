# Search

## Pipeline

1. **Parse** — `parseSearchParams` (`src/lib/validation/search.ts`) turns URL params into a
   `SearchSpec`. Each invalid param is dropped and reported (`ParamIssue`), so a bad link still
   runs the rest of the search and the page explains what was ignored.
2. **Build** — `buildGitHubQuery` (`src/server/providers/github/query.ts`) converts the spec into
   GitHub search syntax and an explanation for every qualifier. Queries over GitHub's 256-character
   limit are refused with a clear message.
3. **Fetch** — `GitHubProvider.search` calls `/search/repositories` through the cached client.
4. **Validate & normalize** — Zod schemas reject malformed responses; results become
   provider-neutral `RepositorySummary` objects.
5. **Render** — counts, freshness, rows, pagination and the "How this search was sent to GitHub"
   panel.

The URL is the source of truth: every filter change, chip removal, sort and page is a link or a
`router.push` with the serialized spec, so searches are shareable and the back button works.

## Filters

All filters are **provider-native** (applied by GitHub across every repository):

| Filter | URL param | GitHub qualifier | Semantics |
| --- | --- | --- | --- |
| Text | `q` | free text (GitHub qualifiers allowed) | name/description/topics |
| Language | `language=A,B` | `language:A language:B` | any of (verified against the live API) |
| Topics | `topic=a,b` | `topic:a topic:b` | all of (verified) |
| License | `license=mit,apache-2.0` | `license:…` | any of (verified) |
| Owner | `owner` | `user:` | users and organizations |
| Stars / forks / size (KB) | `minStars` `maxStars` … | `stars:a..b` etc. | inclusive |
| Good first issues | `minGoodFirstIssues` | `good-first-issues:>=n` | |
| Created | `created=7d\|30d\|90d\|1y\|custom` + `createdFrom/To` | `created:>=date` | |
| Last pushed | `pushed=24h\|7d\|30d\|90d\|custom` + `pushedFrom/To` | `pushed:>=…` | push to any branch |
| Archived | `archived=include\|exclude\|only` | `archived:false/true` | default include (GitHub default) |
| Forks | `fork=exclude\|include\|only` | `fork:true/only` | default exclude (GitHub default) |

Not searchable on GitHub, therefore not offered as filters: contributor counts, release dates,
commit activity. They appear on repository and comparison pages.

## Sorting

`best` (GitHub relevance), `stars`, `forks`, `updated`, `help-wanted-issues` — all performed by
GitHub across the full result set. GitHub cannot sort by creation date; *Recently created*
filters by a creation window and sorts by stars. The only locally sorted list is **Hidden gems**,
which says so and ranks a stated candidate set.

## Limits

- At most 1,000 results per query: pagination stops there and the UI says so.
- 30 search requests/minute with a token (10 without). Identical searches are served from cache
  for 10 minutes and deduplicated while in flight.
- GitHub may return `incomplete_results` on timeouts; the UI shows a warning.

## Suggestions and AI search

- The ⌘K palette offers "Search GitHub for …", "Open owner/name", repositories RepoAtlas has
  already observed (database only, no API quota), topics and pages.
- AI search (`src/server/ai/interpret.ts`) asks Claude for a fixed-field object, validates it with
  Zod, re-validates every value with the `SearchSpec` schema, drops (and reports) anything with
  search syntax or invalid values, and shows the proposal for correction before running the
  normal search. The model never produces repositories or numbers.
