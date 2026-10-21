import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { EmptyState, ListSkeleton } from "@/components/feedback/states";
import { MethodNote, PageHeader } from "@/components/layout/page-header";
import { LanguageTag } from "@/components/repository/metrics";
import { SearchResults } from "@/components/search/search-results";
import { NEW_AND_NOTABLE_WINDOWS } from "@/config/discovery";
import { formatCount, formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { searchSpecSchema } from "@/lib/validation/search";
import { countSnapshots, getMeasuredGrowth, MIN_GROWTH_SPAN_HOURS, SNAPSHOT_INTERVAL_MS } from "@/server/analytics/snapshots";

export const metadata: Metadata = {
  title: "Trending",
  description: "Repositories gaining stars fastest, measured by RepoAtlas, and new repositories attracting attention.",
};

const paramsSchema = z.object({
  view: z.enum(["measured", "new"]).catch("measured"),
  window: z.enum(["1d", "7d", "30d"]).catch("7d"),
  created: z.enum(["7d", "30d", "90d"]).catch("7d"),
  language: z.string().regex(/^[A-Za-z0-9+#. _'-]{1,40}$/).optional().catch(undefined),
});

const WINDOW_DAYS = { "1d": 1, "7d": 7, "30d": 30 } as const;

export default function TrendingPage({ searchParams }: PageProps<"/trending">) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Trending"
        description="Two honest ways to see what is taking off: growth RepoAtlas has measured itself, and the most-starred new repositories."
      />
      <Suspense fallback={<ListSkeleton />}>
        <TrendingContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function tabHref(p: z.infer<typeof paramsSchema>, patch: Partial<z.infer<typeof paramsSchema>>) {
  const next = { ...p, ...patch };
  const qs = new URLSearchParams();
  qs.set("view", next.view);
  if (next.view === "measured") qs.set("window", next.window);
  else qs.set("created", next.created);
  if (next.language) qs.set("language", next.language);
  return `/trending?${qs}`;
}

async function TrendingContent({ searchParams }: Pick<PageProps<"/trending">, "searchParams">) {
  const raw = await searchParams;
  const p = paramsSchema.parse({
    view: raw.view,
    window: raw.window,
    created: raw.created,
    language: typeof raw.language === "string" && raw.language ? raw.language : undefined,
  });

  const tab = (active: boolean) =>
    cn("rounded-md px-3 py-1.5 text-sm", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground");

  return (
    <div className="space-y-5">
      <nav aria-label="Trending views" className="flex flex-wrap items-center gap-2">
        <Link href={tabHref(p, { view: "measured" })} className={tab(p.view === "measured")} aria-current={p.view === "measured" ? "page" : undefined}>
          Measured growth
        </Link>
        <Link href={tabHref(p, { view: "new" })} className={tab(p.view === "new")} aria-current={p.view === "new" ? "page" : undefined}>
          New and notable
        </Link>
        {p.language && (
          <Link href={tabHref(p, { language: undefined })} className="ml-2 rounded-full border px-3 py-1 text-xs hover:border-destructive/50 hover:text-destructive">
            {p.language} ×
          </Link>
        )}
      </nav>

      {p.view === "measured" ? <Measured p={p} /> : <NewAndNotable p={p} />}
    </div>
  );
}

async function Measured({ p }: { p: z.infer<typeof paramsSchema> }) {
  const days = WINDOW_DAYS[p.window];
  const [rows, counts] = await Promise.all([
    getMeasuredGrowth({ days, limit: 50, language: p.language }),
    countSnapshots(),
  ]);
  return (
    <div className="space-y-4">
      <MethodNote>
        <p>
          RepoAtlas records a repository&apos;s star and fork counts each time it fetches it (at most every{" "}
          {SNAPSHOT_INTERVAL_MS / 3_600_000} hours), and on a scheduled refresh. Growth is the difference between the
          first and last observation inside the window, for repositories observed at least {MIN_GROWTH_SPAN_HOURS} hours
          apart, ranked by stars gained per day. Only repositories RepoAtlas has observed can appear here.
        </p>
      </MethodNote>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Window</span>
        {(Object.keys(WINDOW_DAYS) as (keyof typeof WINDOW_DAYS)[]).map((w) => (
          <Link
            key={w}
            href={tabHref(p, { window: w })}
            aria-current={p.window === w ? "true" : undefined}
            className={cn("rounded-full border px-3 py-1", p.window === w ? "border-primary bg-accent text-accent-foreground" : "hover:border-primary/50")}
          >
            {w === "1d" ? "24 hours" : w === "7d" ? "7 days" : "30 days"}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Not enough observations yet">
          <p>
            RepoAtlas is tracking {formatNumber(counts.tracked)} repositories with {formatNumber(counts.snapshots)} recorded
            observations, but none has two observations at least {MIN_GROWTH_SPAN_HOURS} hours apart in this window yet.
            Growth appears here automatically as observations accumulate.
          </p>
          <p className="mt-2">
            Meanwhile, see{" "}
            <Link href={tabHref(p, { view: "new" })} className="text-primary hover:underline">
              new and notable repositories
            </Link>
            .
          </p>
        </EmptyState>
      ) : (
        <ol className="rounded-lg border bg-card px-3" aria-label="Measured growth">
          {rows.map((r, i) => (
            <li key={r.providerRepoId} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b py-3 last:border-b-0">
              <span className="text-xs text-muted-foreground tabular">{i + 1}</span>
              <div className="min-w-0">
                <Link href={`/repository/${r.fullName}`} className="truncate font-mono text-[0.95rem] hover:underline">
                  {r.fullName}
                </Link>
                <p className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                  {r.language && <LanguageTag language={r.language} />}
                  <span>
                    Observed {formatDate(r.fromAt)} to {formatDate(r.toAt)}
                  </span>
                  <span className="tabular">
                    {formatNumber(r.fromStars)} → {formatNumber(r.toStars)} stars
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className={cn("font-medium tabular", r.starsGained > 0 ? "text-success" : "text-muted-foreground")}>
                  {r.starsGained >= 0 ? "+" : ""}
                  {formatCount(r.starsGained)}
                </p>
                <p className="text-xs text-muted-foreground tabular">{r.starsPerDay.toFixed(1)}/day</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function NewAndNotable({ p }: { p: z.infer<typeof paramsSchema> }) {
  const spec = searchSpecSchema.parse({
    created: p.created,
    sort: "stars",
    archived: "exclude",
    language: p.language ? [p.language] : [],
  });
  return (
    <div className="space-y-4">
      <MethodNote>
        <p>
          Repositories created in the selected window, ordered by total stars. This shows early attention, not measured
          growth: GitHub does not publish star history, so the ordering reflects stars accumulated since creation.
        </p>
      </MethodNote>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {NEW_AND_NOTABLE_WINDOWS.map((w) => (
          <Link
            key={w.value}
            href={tabHref(p, { created: w.value })}
            aria-current={p.created === w.value ? "true" : undefined}
            className={cn("rounded-full border px-3 py-1", p.created === w.value ? "border-primary bg-accent text-accent-foreground" : "hover:border-primary/50")}
          >
            {w.label}
          </Link>
        ))}
      </div>
      <Suspense key={`${p.created}-${p.language}`} fallback={<ListSkeleton />}>
        <SearchResults spec={spec} basePath="/explore" ranked />
      </Suspense>
    </div>
  );
}
