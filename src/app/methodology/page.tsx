import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { MAX_SEARCH_RESULTS } from "@/lib/validation/search";
import { MIN_GROWTH_SPAN_HOURS, SNAPSHOT_INTERVAL_MS } from "@/server/analytics/snapshots";
import { HEALTH_VERSION, HEALTH_WEIGHTS } from "@/server/ranking/health";
import { HIDDEN_GEM_BAND, HIDDEN_GEMS_VERSION } from "@/server/ranking/hidden-gems";

export const metadata: Metadata = {
  title: "How rankings work",
  description: "Where RepoAtlas data comes from and exactly how its scores and rankings are calculated.",
};

const HEALTH_ROWS: [keyof typeof HEALTH_WEIGHTS, string, string][] = [
  ["maintenance", "Maintenance", "Days since the last push. Full score within 14 days, falling linearly to zero at 365 days. Archived repositories score zero."],
  ["activity", "Commit activity", "Commits on the default branch in the last 12 weeks, log-scaled; full score at 120 or more."],
  ["releases", "Release cadence", "Age of the latest GitHub release: full within 90 days, zero at 730. Repositories without releases are not scored on this, rather than penalised."],
  ["adoption", "Community adoption", "Stars (70%) and forks (30%), each log-scaled; full score at 100,000 stars and 10,000 forks."],
  ["community", "Documentation and community files", "README (30%), contributing guide (20%), issue template (15%), description (15%), PR template (10%), code of conduct (10%), from GitHub's community profile."],
  ["license", "License clarity", "1 for a recognised SPDX license, 0.5 for an unrecognised license file, 0 for none."],
  ["contributors", "Contributor base", "Number of contributors, log-scaled; full score at 100 or more (GitHub's list stops at 100)."],
];

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-10">
      <PageHeader
        title="How rankings work"
        description="RepoAtlas separates facts from derived scores. Facts come straight from GitHub; every score below is calculated by RepoAtlas, versioned, and shown with its inputs."
      />

      <section id="data" className="space-y-3 scroll-mt-20">
        <h2 className="text-xl font-semibold">Where the data comes from</h2>
        <p className="leading-relaxed">
          Stars, forks, issues, languages, licenses, topics, releases, contributors and commit statistics come from the
          documented GitHub REST API. Responses are cached for minutes to hours depending on how quickly each kind of data
          changes; every page shows when its data was fetched. If GitHub is unavailable or rate-limited, RepoAtlas may show
          an older cached copy and says so.
        </p>
        <p className="leading-relaxed">
          Open issue counts on GitHub include open pull requests. RepoAtlas shows them as “open issues and PRs”.
        </p>
      </section>

      <section id="search" className="space-y-3 scroll-mt-20">
        <h2 className="text-xl font-semibold">Search and sorting</h2>
        <p className="leading-relaxed">
          Explore and the discovery pages send your filters to GitHub&apos;s repository search, which filters and sorts across
          all public repositories. GitHub only returns the first {MAX_SEARCH_RESULTS.toLocaleString("en-US")} results of any
          search. Selecting several languages or licenses matches any of them; selecting several topics requires all of
          them. Each results page includes the exact query sent to GitHub.
        </p>
        <p className="leading-relaxed">
          GitHub cannot sort by creation date, so “Recently created” filters by a creation window and orders by stars.
          GitHub&apos;s “recently updated” order also reacts to metadata events such as new stars, which is why that page
          additionally requires a recent push.
        </p>
      </section>

      <section id="trending" className="space-y-3 scroll-mt-20">
        <h2 className="text-xl font-semibold">Trending and growth</h2>
        <p className="leading-relaxed">
          GitHub does not publish star history or a trending list. RepoAtlas records a snapshot of a repository&apos;s
          stars, forks and open issues whenever it fetches that repository (at most once every{" "}
          {SNAPSHOT_INTERVAL_MS / 3_600_000} hours), and on a scheduled refresh of tracked repositories. Growth is the
          difference between the first and last snapshot inside a window, and is only shown when those snapshots are at
          least {MIN_GROWTH_SPAN_HOURS} hours apart. Repositories RepoAtlas has never observed cannot appear in measured
          growth.
        </p>
        <p className="leading-relaxed">
          Until enough history exists, the Trending page offers “New and notable”: repositories created recently, ordered by
          stars. That reflects early attention, not measured growth, and is labelled that way.
        </p>
      </section>

      <section id="health-score" className="space-y-3 scroll-mt-20">
        <h2 className="text-xl font-semibold">Health score ({HEALTH_VERSION})</h2>
        <p className="leading-relaxed">
          A 0–100 summary of public signals about maintenance and community. Each dimension maps data to a 0–1 score and is
          weighted as below. When a dimension has no data, it is left out and the remaining weights are re-normalised. If
          less than 60% of the weight has data, the score is marked provisional; below 40%, no score is shown.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Dimension</th>
                <th scope="col" className="px-3 py-2 font-medium">Weight</th>
                <th scope="col" className="px-3 py-2 font-medium">How it is scored</th>
              </tr>
            </thead>
            <tbody>
              {HEALTH_ROWS.map(([key, name, how]) => (
                <tr key={key} className="border-t align-top">
                  <td className="px-3 py-2 font-medium">{name}</td>
                  <td className="px-3 py-2 tabular">{HEALTH_WEIGHTS[key]}</td>
                  <td className="px-3 py-2 text-muted-foreground">{how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="leading-relaxed">
          Raw open-issue counts are intentionally excluded: they grow with a project&apos;s user base, so they say little
          about quality on their own. The health score is not a GitHub metric, and it does not assess code quality or
          security.
        </p>
      </section>

      <section id="hidden-gems" className="space-y-3 scroll-mt-20">
        <h2 className="text-xl font-semibold">Hidden gems ({HIDDEN_GEMS_VERSION})</h2>
        <p className="leading-relaxed">
          Candidates are the 50 most recently updated repositories with {HIDDEN_GEM_BAND.minStars}–
          {HIDDEN_GEM_BAND.maxStars.toLocaleString("en-US")} stars, pushed in the last 30 days, at least a month old, and
          neither forks nor archived. They are then ranked locally by:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Recent maintenance (35%): score halves for every 21 days since the last push.</li>
          <li>Hands-on engagement (25%): forks per star, full score at 0.25.</li>
          <li>Presentation (20%): description, recognised license, three or more topics, homepage.</li>
          <li>Measured momentum (20%): stars per day from RepoAtlas snapshots, when available; otherwise left out.</li>
        </ul>
        <p className="leading-relaxed">
          Star count is a filter, not a score input. The ranking describes the candidate set only.
        </p>
      </section>

      <section id="topics" className="space-y-3 scroll-mt-20">
        <h2 className="text-xl font-semibold">Topics and aggregates</h2>
        <p className="leading-relaxed">
          Topic pages use the topic tags maintainers assign on GitHub. Language and related-topic lists are counted over a
          stated sample (for example, the 30 most-starred repositories with a topic) and describe that sample only, not
          GitHub as a whole.
        </p>
      </section>

      <p className="text-sm text-muted-foreground">
        Something wrong or unclear? Each score links back here; current integration status is on the{" "}
        <Link href="/status" className="text-primary hover:underline">
          status page
        </Link>
        .
      </p>
    </div>
  );
}
