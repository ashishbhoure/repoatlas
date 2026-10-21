import { Suspense } from "react";
import { ListSkeleton } from "@/components/feedback/states";
import { Filters } from "@/components/filters/filter-panel";
import { MethodNote, PageHeader } from "@/components/layout/page-header";
import { FilterChips } from "@/components/search/filter-chips";
import { ParamIssues } from "@/components/search/param-issues";
import { SearchResults } from "@/components/search/search-results";
import { DISCOVERY_VIEWS, type DiscoverySlug } from "@/config/discovery";
import { parseSearchParams, searchSpecSchema, specToQueryString, type RawParams, type SearchSpec } from "@/lib/validation/search";

/**
 * Applies a discovery view: the view's base spec, overlaid with the user's filters from the
 * URL, except for locked keys which always come from the view.
 */
export function resolveDiscoverySpec(slug: DiscoverySlug, raw: RawParams) {
  const view = DISCOVERY_VIEWS[slug];
  const hasParams = Object.keys(raw).length > 0;
  const base = searchSpecSchema.parse(view.base);
  const { spec: fromUrl, issues } = parseSearchParams(raw);
  // Without any params, the view's defaults apply (e.g. "created in the last 30 days").
  const merged: SearchSpec = hasParams ? { ...fromUrl } : { ...base };
  for (const k of view.locked) (merged as Record<string, unknown>)[k] = base[k];
  return { spec: merged, issues, view };
}

export function DiscoveryPage({ slug, searchParams }: { slug: DiscoverySlug; searchParams: Promise<RawParams> }) {
  const view = DISCOVERY_VIEWS[slug];
  const basePath = `/${view.slug}`;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title={view.title} />
      <MethodNote>
        <p>{view.method}</p>
        {"caveat" in view && view.caveat && <p className="mt-1 text-muted-foreground">{view.caveat}</p>}
      </MethodNote>
      <Suspense fallback={<ListSkeleton />}>
        <DiscoveryContent slug={slug} searchParams={searchParams} basePath={basePath} />
      </Suspense>
    </div>
  );
}

async function DiscoveryContent({ slug, searchParams, basePath }: { slug: DiscoverySlug; searchParams: Promise<RawParams>; basePath: string }) {
  const { spec, issues, view } = resolveDiscoverySpec(slug, await searchParams);
  const locked = view.locked as (keyof SearchSpec)[];
  const qs = specToQueryString(spec);
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Filters key={`f-${qs}`} spec={spec} basePath={basePath} locked={locked} />
      </div>
      <div className="min-w-0 space-y-4">
        <ParamIssues issues={issues} />
        <FilterChips spec={spec} basePath={basePath} locked={locked} />
        <Suspense key={qs} fallback={<ListSkeleton />}>
          <SearchResults spec={spec} basePath={basePath} ranked={spec.sort === "stars" || spec.sort === "forks"} />
        </Suspense>
      </div>
    </div>
  );
}
