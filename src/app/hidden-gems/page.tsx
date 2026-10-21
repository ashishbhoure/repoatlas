import { requestNow } from "@/lib/request-time";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ScoreExplainer } from "@/components/analytics/score-explainer";
import { EmptyState, ErrorState, FreshnessNote, ListSkeleton } from "@/components/feedback/states";
import { Filters } from "@/components/filters/filter-panel";
import { MethodNote, PageHeader } from "@/components/layout/page-header";
import { RepoList, RepoRow } from "@/components/repository/repo-row";
import { FilterChips } from "@/components/search/filter-chips";
import { ParamIssues } from "@/components/search/param-issues";
import { toAppError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { parseSearchParams, specToQueryString, type SearchSpec } from "@/lib/validation/search";
import { getMeasuredGrowth } from "@/server/analytics/snapshots";
import { HIDDEN_GEM_BAND, HIDDEN_GEMS_VERSION, rankHiddenGems } from "@/server/ranking/hidden-gems";
import { searchRepositories } from "@/server/repositories/search";

export const metadata: Metadata = {
  title: "Hidden Gems",
  description: "Actively maintained, lesser-known repositories, ranked by an explainable score.",
};

const CANDIDATES = 50;
/** Everything except language/topic/license is fixed by the candidate definition. */
const LOCKED: (keyof SearchSpec)[] = [
  "q", "owner", "minStars", "maxStars", "minForks", "maxForks", "minSize", "maxSize", "minGoodFirstIssues",
  "created", "createdFrom", "createdTo", "pushed", "pushedFrom", "pushedTo", "archived", "fork", "sort", "order", "page", "perPage",
];

function candidateSpec(user: SearchSpec): SearchSpec {
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  return {
    ...user,
    q: "",
    owner: undefined,
    minStars: HIDDEN_GEM_BAND.minStars,
    maxStars: HIDDEN_GEM_BAND.maxStars,
    minForks: undefined,
    maxForks: undefined,
    minSize: undefined,
    maxSize: undefined,
    minGoodFirstIssues: undefined,
    created: "custom",
    createdFrom: undefined,
    createdTo: monthAgo,
    pushed: "30d",
    pushedFrom: undefined,
    pushedTo: undefined,
    archived: "exclude",
    fork: "exclude",
    sort: "updated",
    order: "desc",
    page: 1,
    perPage: CANDIDATES,
  };
}

export default function HiddenGemsPage({ searchParams }: PageProps<"/hidden-gems">) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Hidden gems" description="Lesser-known repositories that are actively maintained and show signs of real use." />
      <MethodNote>
        <p>
          Candidates: the {CANDIDATES} most recently updated repositories with {formatNumber(HIDDEN_GEM_BAND.minStars)}–
          {formatNumber(HIDDEN_GEM_BAND.maxStars)} stars, a push in the last 30 days, at least a month old, excluding
          forks and archived projects. RepoAtlas then ranks those candidates by recent maintenance, forks relative to
          stars, presentation (description, license, topics, homepage) and, once measured, star momentum.
        </p>
        <p className="mt-1 text-muted-foreground">
          Star count itself is not a scoring input. The ranking covers this candidate set only, not every repository on
          GitHub. Open a score to see its breakdown, or read the{" "}
          <Link href="/methodology#hidden-gems" className="text-primary hover:underline">
            full method
          </Link>
          .
        </p>
      </MethodNote>
      <Suspense fallback={<ListSkeleton />}>
        <GemsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function GemsContent({ searchParams }: Pick<PageProps<"/hidden-gems">, "searchParams">) {
  const { spec: userSpec, issues } = parseSearchParams(await searchParams);
  const filterSpec: SearchSpec = { ...userSpec, page: 1 };
  const qs = specToQueryString({ language: userSpec.language, topic: userSpec.topic, license: userSpec.license });
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Filters key={`f-${qs}`} spec={filterSpec} basePath="/hidden-gems" locked={LOCKED} />
      </div>
      <div className="min-w-0 space-y-4">
        <ParamIssues issues={issues} />
        <FilterChips spec={filterSpec} basePath="/hidden-gems" locked={LOCKED} />
        <Suspense key={qs} fallback={<ListSkeleton />}>
          <GemList spec={candidateSpec(userSpec)} />
        </Suspense>
      </div>
    </div>
  );
}

async function GemList({ spec }: { spec: SearchSpec }) {
  let result;
  try {
    result = await searchRepositories(spec);
  } catch (e) {
    return <ErrorState error={toAppError(e)} retryHref="/hidden-gems" />;
  }
  const growth = await getMeasuredGrowth({ days: 30, limit: CANDIDATES, providerRepoIds: result.items.map((r) => r.providerId) });
  const ranked = rankHiddenGems(result.items, { growth: new Map(growth.map((g) => [g.providerRepoId, g.starsPerDay])) });
  const now = requestNow();
  if (ranked.length === 0) {
    return <EmptyState title="No candidates match these filters">Try another language or topic.</EmptyState>;
  }
  return (
    <div className="space-y-3">
      <FreshnessNote freshness={result.freshness} now={now} />
      <RepoList label="Hidden gems">
        {ranked.map(({ repo, gem }, i) => (
          <RepoRow
            key={repo.providerId}
            repo={repo}
            now={now}
            rank={i + 1}
            indicator={
              <ScoreExplainer
                label="Gem score"
                score={gem.score}
                version={HIDDEN_GEMS_VERSION}
                factors={gem.factors.map((f) => ({ label: f.label, weightLabel: `${Math.round(f.weight * 100)}%`, score: f.score, detail: f.detail }))}
                note={gem.factors.some((f) => f.score === null) ? "Factors marked “not scored” had no data; their weight was spread across the others." : undefined}
              />
            }
          />
        ))}
      </RepoList>
    </div>
  );
}
