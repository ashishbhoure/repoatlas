import { caught } from "@/lib/errors/server";
import { requestNow } from "@/lib/request-time";
import { X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompareHistoryChart, CompareMetricChart, SERIES_COLORS } from "@/components/charts/charts";
import { AddRepoForm } from "@/components/compare/add-repo-form";
import { ErrorState, ListSkeleton } from "@/components/feedback/states";
import { MethodNote, PageHeader } from "@/components/layout/page-header";
import { compareHref, parseCompareParam } from "@/features/repository-comparison/parse";
import type { AppError } from "@/lib/errors";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { getSnapshotHistory } from "@/server/analytics/snapshots";
import { getRepositoryOverview, type RepositoryOverview } from "@/server/repositories/details";

export const metadata: Metadata = {
  title: "Compare repositories",
  description: "Compare up to four GitHub repositories side by side.",
};

export default function ComparePage({ searchParams }: PageProps<"/compare">) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Compare repositories" description="Put up to four repositories side by side. The link updates as you go, so you can share the comparison." />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <CompareContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Loaded = { name: string; slot: number } & ({ ok: true; overview: RepositoryOverview } | { ok: false; error: AppError });

async function CompareContent({ searchParams }: Pick<PageProps<"/compare">, "searchParams">) {
  const { repos, issues } = parseCompareParam((await searchParams).repos);
  const loaded: Loaded[] = await Promise.all(
    repos.map(async (name, slot): Promise<Loaded> => {
      const [owner, repo] = name.split("/");
      try {
        return { name, slot, ok: true, overview: await getRepositoryOverview(owner, repo) };
      } catch (e) {
        return { name, slot, ok: false, error: caught(e) };
      }
    }),
  );
  const good = loaded.filter((l): l is Loaded & { ok: true; overview: RepositoryOverview } => l.ok);
  const canonical = loaded.map((l) => (l.ok ? l.overview.repo.fullName : l.name));
  const now = await requestNow();

  return (
    <div className="space-y-6">
      <AddRepoForm current={canonical} />
      {issues.length > 0 && (
        <ul role="status" className="rounded-md border border-warning/40 bg-warning/5 px-4 py-2 text-sm">
          {issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}

      {repos.length === 0 && (
        <MethodNote>
          Add repositories above, or start from an example:{" "}
          <Link href={compareHref(["facebook/react", "vuejs/core", "sveltejs/svelte"])} className="text-primary hover:underline">
            React vs Vue vs Svelte
          </Link>
          ,{" "}
          <Link href={compareHref(["fastapi/fastapi", "pallets/flask", "django/django"])} className="text-primary hover:underline">
            FastAPI vs Flask vs Django
          </Link>
          .
        </MethodNote>
      )}

      {loaded.filter((l) => !l.ok).map((l) => (
        <div key={l.name} className="space-y-1">
          <p className="text-sm font-medium font-mono">{l.name}</p>
          {!l.ok && <ErrorState error={l.error} />}
          <Link href={compareHref(canonical.filter((c) => c !== l.name))} className="text-sm text-primary hover:underline">
            Remove from comparison
          </Link>
        </div>
      ))}

      {good.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[40rem] text-sm" data-testid="compare-table">
              <caption className="sr-only">Repository comparison</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="w-48 px-4 py-3 text-left font-medium text-muted-foreground">
                    Metric
                  </th>
                  {good.map((l) => (
                    <th key={l.name} scope="col" className="px-4 py-3 text-left align-top font-normal">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/repository/${l.overview.repo.fullName}`} className="flex items-center gap-2 font-mono font-medium hover:underline">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: SERIES_COLORS[l.slot] }} aria-hidden />
                          {l.overview.repo.fullName}
                        </Link>
                        <Link
                          href={compareHref(canonical.filter((c) => c !== l.overview.repo.fullName))}
                          aria-label={`Remove ${l.overview.repo.fullName} from comparison`}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                        >
                          <X className="size-4" />
                        </Link>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="px-4 py-2.5 text-left font-normal text-muted-foreground">
                      {row.label}
                      {row.hint && <span className="block text-xs">{row.hint}</span>}
                    </th>
                    {good.map((l) => (
                      <td key={l.name} className="px-4 py-2.5 tabular">
                        {row.value(l.overview, now) ?? <span className="text-muted-foreground">Unavailable</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {good.length > 1 && (
            <section className="space-y-3" aria-labelledby="charts">
              <h2 id="charts" className="font-semibold">
                Side by side
              </h2>
              <p className="text-xs text-muted-foreground">Each metric has its own chart and scale, so values of different kinds are never drawn on one axis.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <CompareMetricChart title="Stars" rows={good.map((l) => ({ name: l.overview.repo.fullName, slot: l.slot, value: l.overview.repo.stars }))} />
                <CompareMetricChart title="Forks" rows={good.map((l) => ({ name: l.overview.repo.fullName, slot: l.slot, value: l.overview.repo.forks }))} />
                <CompareMetricChart title="Commits, last 12 weeks" rows={good.map((l) => ({ name: l.overview.repo.fullName, slot: l.slot, value: recentCommits(l.overview) }))} />
                <CompareMetricChart title="Health score" rows={good.map((l) => ({ name: l.overview.repo.fullName, slot: l.slot, value: l.overview.health.score }))} />
              </div>
              <Suspense fallback={null}>
                <History repos={good.map((l) => ({ name: l.overview.repo.fullName, slot: l.slot, providerId: l.overview.repo.providerId }))} />
              </Suspense>
            </section>
          )}

          <MethodNote>
            <p>
              Open issues include pull requests and grow with a project&apos;s popularity, so a higher number is not by
              itself a sign of lower quality. Contributor lists stop at 100 on GitHub&apos;s API, shown as “100+”. Health
              scores use the{" "}
              <Link href="/methodology#health-score" className="text-primary hover:underline">
                documented method
              </Link>{" "}
              and are only comparable within the same algorithm version.
            </p>
          </MethodNote>
        </>
      )}
    </div>
  );
}

function recentCommits(o: RepositoryOverview): number | null {
  if (!o.commitActivity || o.commitActivity.length === 0) return null;
  return o.commitActivity.slice(-12).reduce((s, w) => s + w.commits, 0);
}

const ROWS: { label: string; hint?: string; value: (o: RepositoryOverview, now: number) => React.ReactNode | null }[] = [
  { label: "Stars", value: (o) => formatNumber(o.repo.stars) },
  { label: "Forks", value: (o) => formatNumber(o.repo.forks) },
  { label: "Open issues and PRs", hint: "Scales with popularity", value: (o) => formatNumber(o.repo.openIssues) },
  { label: "Primary language", value: (o) => o.repo.language },
  {
    label: "License",
    value: (o) => (o.repo.license ? (o.repo.license.spdxId && o.repo.license.spdxId !== "NOASSERTION" ? o.repo.license.spdxId : "Unrecognised") : "None detected"),
  },
  { label: "Created", value: (o) => formatDate(o.repo.createdAt) },
  { label: "Last push", value: (o, now) => (o.repo.pushedAt ? `${formatDate(o.repo.pushedAt)} (${formatRelative(o.repo.pushedAt, now)})` : null) },
  { label: "Archived", value: (o) => (o.repo.archived ? "Yes" : "No") },
  {
    label: "Latest release",
    value: (o) =>
      o.latestRelease === undefined ? null : o.latestRelease === null ? "No releases" : `${o.latestRelease.tagName}${o.latestRelease.publishedAt ? `, ${formatDate(o.latestRelease.publishedAt)}` : ""}`,
  },
  {
    label: "Contributors",
    value: (o) => (o.contributors ? `${o.contributors.contributors.length}${o.contributors.truncated ? "+" : ""}` : null),
  },
  { label: "Commits, last 12 weeks", value: (o) => { const c = recentCommits(o); return c === null ? null : formatNumber(c); } },
  {
    label: "Health score",
    hint: "RepoAtlas health@1",
    value: (o) => (o.health.score === null ? "Not enough data" : `${o.health.score}/100${o.health.status === "provisional" ? " (provisional)" : ""}`),
  },
];

async function History({ repos }: { repos: { name: string; slot: number; providerId: string }[] }) {
  const series = (
    await Promise.all(repos.map(async (r) => ({ ...r, points: await getSnapshotHistory(r.providerId) })))
  ).filter((s) => s.points.length >= 2);
  if (series.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        A star history comparison appears once RepoAtlas has observed at least two of these repositories twice.
      </p>
    );
  }
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium">Stars over time (RepoAtlas observations)</h3>
      <CompareHistoryChart series={series.map((s) => ({ name: s.name, slot: s.slot, points: s.points }))} />
    </div>
  );
}
