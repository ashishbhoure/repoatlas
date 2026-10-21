import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/feedback/states";
import { Filters } from "@/components/filters/filter-panel";
import { PageHeader } from "@/components/layout/page-header";
import { FilterChips } from "@/components/search/filter-chips";
import { ParamIssues } from "@/components/search/param-issues";
import { SaveSearchButton, SearchBox, SortSelect } from "@/components/search/search-controls";
import { SearchResults } from "@/components/search/search-results";
import { features } from "@/config/env";
import { getCurrentUser } from "@/lib/auth/session";
import { hasCriteria, parseSearchParams, specToQueryString } from "@/lib/validation/search";

export const metadata: Metadata = {
  title: "Explore",
  description: "Search public GitHub repositories with advanced filters.",
};

const EXAMPLES = [
  { label: "TypeScript authentication libraries with 1,000+ stars, MIT licensed", href: "/explore?q=authentication&language=TypeScript&license=mit&minStars=1000&archived=exclude" },
  { label: "Python projects using FastAPI and PostgreSQL", href: "/explore?language=Python&topic=fastapi,postgresql&sort=stars" },
  { label: "AI agent frameworks pushed in the last 30 days", href: "/explore?topic=ai-agents&pushed=30d&sort=stars" },
  { label: "Rust CLI tools with good first issues", href: "/explore?language=Rust&topic=cli&minGoodFirstIssues=1&sort=stars" },
  { label: "React component libraries, most forked", href: "/explore?topic=react,component-library&sort=forks" },
];

export default function ExplorePage({ searchParams }: PageProps<"/explore">) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Explore"
        description="Search every public repository on GitHub. Filters are applied by GitHub itself, so results cover all matches, not a sample."
      />
      <Suspense fallback={<ListSkeleton />}>
        <ExploreContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ExploreContent({ searchParams }: Pick<PageProps<"/explore">, "searchParams">) {
  const { spec, issues } = parseSearchParams(await searchParams);
  const qs = specToQueryString(spec);
  const user = await getCurrentUser();
  const active = hasCriteria(spec);

  return (
    <>
      <SearchBox key={`q-${spec.q}`} spec={spec} basePath="/explore" autoFocus={!active} />
      <ParamIssues issues={issues} />
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Filters key={`f-${qs}`} spec={spec} basePath="/explore" />
        </div>
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterChips spec={spec} basePath="/explore" />
            <div className="ml-auto flex items-center gap-2">
              {active && <SaveSearchButton spec={spec} signedIn={!!user} authEnabled={features.auth()} />}
              <SortSelect spec={spec} basePath="/explore" />
            </div>
          </div>
          {active ? (
            <Suspense key={qs} fallback={<ListSkeleton />}>
              <SearchResults spec={spec} basePath="/explore" />
            </Suspense>
          ) : (
            <section aria-labelledby="examples" className="rounded-lg border bg-card p-5">
              <h2 id="examples" className="font-medium">
                Start with a question
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Type keywords above, set filters, or open one of these searches.</p>
              <ul className="mt-4 space-y-2">
                {EXAMPLES.map((e) => (
                  <li key={e.href}>
                    <Link href={e.href} className="text-sm text-primary underline-offset-2 hover:underline">
                      {e.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
