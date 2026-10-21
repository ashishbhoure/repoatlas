import { caught, rethrowFrameworkErrors } from "@/lib/errors/server";
import { requestNow } from "@/lib/request-time";
import { Archive, ExternalLink, GitCompareArrows, Globe, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HealthCard } from "@/components/analytics/health-card";
import { CommitActivityChart, StarHistoryChart } from "@/components/charts/charts";
import { AddToCollectionButton } from "@/components/collections/add-to-collection";
import { ErrorState, FreshnessNote, ListSkeleton } from "@/components/feedback/states";
import { LanguageTag } from "@/components/repository/metrics";
import { RepoList, RepoRow } from "@/components/repository/repo-row";
import { SaveRepositoryButton } from "@/components/repository/save-button";
import { CopyButton, ShareButton } from "@/components/repository/share-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LANGUAGE_COLORS } from "@/config/filters";
import { isAppError } from "@/lib/errors";
import { formatBytesFromKb, formatCount, formatDate, formatNumber, formatRelative } from "@/lib/format";
import { extractHeadings } from "@/lib/markdown/sanitize-readme";
import { searchSpecSchema } from "@/lib/validation/search";
import { getSnapshotHistory } from "@/server/analytics/snapshots";
import { getLibraryState } from "@/server/collections/library";
import { getRepositoryOverview, getSanitizedReadme, type RepositoryOverview } from "@/server/repositories/details";
import { searchRepositories } from "@/server/repositories/search";
import type { RepositoryDetails } from "@/types/repository";

const SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/;

export async function generateMetadata({ params }: PageProps<"/repository/[owner]/[name]">): Promise<Metadata> {
  const { owner, name } = await params;
  return { title: `${owner}/${name}`, description: `Metadata, health score and activity for ${owner}/${name}.` };
}

export default function RepositoryPage({ params }: PageProps<"/repository/[owner]/[name]">) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<RepositorySkeleton />}>
        <RepositoryContent params={params} />
      </Suspense>
    </div>
  );
}

function RepositorySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      <ListSkeleton rows={3} />
    </div>
  );
}

async function RepositoryContent({ params }: Pick<PageProps<"/repository/[owner]/[name]">, "params">) {
  const { owner, name } = await params;
  if (!SEGMENT.test(owner) || !SEGMENT.test(name)) notFound();

  let overview: RepositoryOverview;
  try {
    overview = await getRepositoryOverview(owner, name);
  } catch (e) {
    rethrowFrameworkErrors(e);
    if (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "INVALID_INPUT")) notFound();
    return <ErrorState error={caught(e)} retryHref={`/repository/${owner}/${name}`} />;
  }
  const { repo } = overview;
  const now = await requestNow();
  const library = await getLibraryState([repo.providerId]);
  const isAwesomeList = repo.topics.includes("awesome-list") || repo.topics.includes("awesome");

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href={`/explore?owner=${repo.owner}`} className="hover:underline">
            {repo.owner}
          </Link>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          {repo.ownerAvatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- owner avatar from GitHub's CDN
            <img src={`${repo.ownerAvatarUrl}${repo.ownerAvatarUrl.includes("?") ? "&" : "?"}s=80`} alt="" width={36} height={36} className={repo.ownerType === "Organization" ? "size-9 rounded-md" : "size-9 rounded-full"} />
          )}
          <h1 className="break-all font-mono text-2xl tracking-tight">
            <span className="text-muted-foreground">{repo.owner}/</span>
            <span className="font-semibold">{repo.name}</span>
          </h1>
          {repo.archived && (
            <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
              <Archive className="size-3" aria-hidden /> Archived
            </Badge>
          )}
          {repo.isFork && <Badge variant="outline">Fork</Badge>}
          {repo.isTemplate && <Badge variant="outline">Template</Badge>}
        </div>
        <p className="max-w-3xl text-[1.02rem] leading-relaxed">
          {repo.description ?? <span className="italic text-muted-foreground">The maintainers have not added a description.</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <a href={repo.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Open on GitHub
            </a>
          </Button>
          {library.enabled && (
            <>
              <SaveRepositoryButton repo={{ providerId: repo.providerId, fullName: repo.fullName }} initiallySaved={library.savedIds.has(repo.providerId)} signedIn={library.signedIn} size="sm" className="border" />
              <AddToCollectionButton repo={{ providerId: repo.providerId, fullName: repo.fullName }} signedIn={library.signedIn} />
            </>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/compare?repos=${repo.fullName}`}>
              <GitCompareArrows /> Compare
            </Link>
          </Button>
          <CopyButton value={repo.url} label="Copy URL" />
          <ShareButton title={repo.fullName} />
        </div>
        <FreshnessNote freshness={overview.freshness} now={now} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <HealthCard health={overview.health} now={now} />

          <section aria-labelledby="activity" className="rounded-lg border bg-card p-5">
            <h2 id="activity" className="font-semibold">
              Commit activity
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">Commits per week on the default branch over the last year, from GitHub&apos;s repository statistics.</p>
            {overview.commitActivity && overview.commitActivity.length > 0 ? (
              <CommitActivityChart weeks={overview.commitActivity} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {overview.commitActivity === null
                  ? "GitHub is still computing statistics for this repository. Reload in a minute to see them."
                  : "Commit statistics are not available for this repository."}
              </p>
            )}
          </section>

          <Suspense fallback={<div className="h-40 animate-pulse rounded-lg border bg-card" />}>
            <StarHistory repo={repo} />
          </Suspense>

          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg border bg-card" />}>
            <Readme repo={repo} awesome={isAwesomeList} />
          </Suspense>

          <Suspense fallback={<ListSkeleton rows={3} />}>
            <Related repo={repo} />
          </Suspense>
        </div>

        <aside className="space-y-5">
          <Facts repo={repo} />
          <ReleaseCard overview={overview} now={now} />
          <Languages languages={overview.languages} />
          <Contributors overview={overview} />
          {repo.topics.length > 0 && (
            <section className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold">Topics</h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {repo.topics.map((t) => (
                  <li key={t}>
                    <Link href={`/topics/${t}`} className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground hover:bg-primary/15">
                      {t}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}

function Facts({ repo }: { repo: RepositoryDetails }) {
  const license = repo.license
    ? repo.license.spdxId && repo.license.spdxId !== "NOASSERTION"
      ? repo.license.spdxId
      : `${repo.license.name} (not a recognised SPDX license)`
    : "None detected";
  const rows: [string, React.ReactNode][] = [
    ["Stars", <span key="s" className="tabular">{formatNumber(repo.stars)}</span>],
    ["Forks", <span key="f" className="tabular">{formatNumber(repo.forks)}</span>],
    ["Open issues and PRs", <span key="i" className="tabular" title="GitHub reports issues and pull requests as one number">{formatNumber(repo.openIssues)}</span>],
    ["Watchers", repo.subscribers !== null ? <span key="w" className="tabular">{formatNumber(repo.subscribers)}</span> : "Unavailable"],
    ["Language", repo.language ? <LanguageTag key="l" language={repo.language} /> : "Not detected"],
    ["License", license],
    ["Created", formatDate(repo.createdAt)],
    ["Last push", repo.pushedAt ? formatDate(repo.pushedAt) : "Unknown"],
    ["Default branch", <code key="b" className="font-mono text-xs">{repo.defaultBranch}</code>],
    ["Size", formatBytesFromKb(repo.sizeKb)],
  ];
  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="facts">
      <h2 id="facts" className="text-sm font-semibold">
        About
      </h2>
      <dl className="mt-2 divide-y text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-1.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
      {repo.homepage && /^https?:\/\//.test(repo.homepage) && (
        <a href={repo.homepage} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 flex items-center gap-1.5 truncate text-sm text-primary hover:underline">
          <Globe className="size-3.5 shrink-0" aria-hidden /> {repo.homepage.replace(/^https?:\/\//, "")}
        </a>
      )}
    </section>
  );
}

function ReleaseCard({ overview, now }: { overview: RepositoryOverview; now: number }) {
  const r = overview.latestRelease;
  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="release">
      <h2 id="release" className="text-sm font-semibold">
        Latest release
      </h2>
      {r === undefined ? (
        <p className="mt-2 text-sm text-muted-foreground">Release data could not be loaded.</p>
      ) : r === null ? (
        <p className="mt-2 text-sm text-muted-foreground">No releases published on GitHub.</p>
      ) : (
        <div className="mt-2 text-sm">
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:underline">
            <Tag className="size-3.5" aria-hidden /> {r.name ?? r.tagName}
          </a>
          {r.prerelease && <Badge variant="outline" className="ml-2">Pre-release</Badge>}
          {r.publishedAt && (
            <p className="text-xs text-muted-foreground">
              Published {formatDate(r.publishedAt)} ({formatRelative(r.publishedAt, now)})
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Languages({ languages }: { languages: Record<string, number> | null | undefined }) {
  if (!languages) return null;
  const entries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;
  const top = entries.slice(0, 6);
  const other = total - top.reduce((s, [, v]) => s + v, 0);
  const parts = other > 0 ? [...top, ["Other", other] as [string, number]] : top;
  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="langs">
      <h2 id="langs" className="text-sm font-semibold">
        Languages
      </h2>
      <p className="text-xs text-muted-foreground">Share of code by bytes, as detected by GitHub.</p>
      <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {parts.map(([lang, bytes]) => (
          <span key={lang} style={{ width: `${(bytes / total) * 100}%`, background: LANGUAGE_COLORS[lang] ?? "var(--muted-foreground)" }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {parts.map(([lang, bytes]) => (
          <li key={lang} className="flex justify-between gap-2">
            {lang === "Other" ? <span className="text-muted-foreground">Other</span> : <LanguageTag language={lang} />}
            <span className="text-muted-foreground tabular">{bytes / total < 0.001 ? "<0.1" : ((bytes / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Contributors({ overview }: { overview: RepositoryOverview }) {
  const c = overview.contributors;
  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="contributors">
      <h2 id="contributors" className="text-sm font-semibold">
        Contributors
      </h2>
      {!c ? (
        <p className="mt-2 text-sm text-muted-foreground">GitHub does not list contributors for this repository (common for very large projects).</p>
      ) : c.contributors.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No contributors listed.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {c.truncated ? `${c.contributors.length}+ contributors` : `${c.contributors.length} contributor${c.contributors.length === 1 ? "" : "s"}`} with commits on the default branch.
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {c.contributors.slice(0, 18).map((p) => (
              <li key={p.login}>
                <a href={p.url ?? `https://github.com/${p.login}`} target="_blank" rel="noopener noreferrer" title={`${p.login}: ${formatNumber(p.contributions)} commits`}>
                  {p.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatars from GitHub's CDN
                    <img src={`${p.avatarUrl}${p.avatarUrl.includes("?") ? "&" : "?"}s=56`} alt={p.login} width={28} height={28} loading="lazy" className="size-7 rounded-full" />
                  ) : (
                    <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs">{p.login[0]}</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

async function StarHistory({ repo }: { repo: RepositoryDetails }) {
  const points = await getSnapshotHistory(repo.providerId);
  return (
    <section aria-labelledby="stars-history" className="rounded-lg border bg-card p-5">
      <h2 id="stars-history" className="font-semibold">
        Star history
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Star counts recorded by RepoAtlas each time it observed this repository. GitHub does not publish historical counts,
        so history starts at RepoAtlas&apos;s first observation.
      </p>
      {points.length >= 2 ? (
        <StarHistoryChart points={points} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {points.length === 1
            ? `First observed ${formatDate(points[0].observedAt)} with ${formatNumber(points[0].stars)} stars. A chart appears after the next observation.`
            : "Tracking starts with this visit. A chart appears once RepoAtlas has observed the repository at least twice."}
        </p>
      )}
    </section>
  );
}

async function Readme({ repo, awesome }: { repo: RepositoryDetails; awesome: boolean }) {
  let readme;
  try {
    readme = await getSanitizedReadme(repo);
  } catch (e) {
    return <ErrorState error={caught(e)} />;
  }
  if (!readme.html) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">This repository has no README.</p>;
  }
  const headings = awesome ? extractHeadings(readme.html).filter((h) => h.level === 2) : [];
  return (
    <section aria-labelledby="readme" className="rounded-lg border bg-card">
      <h2 id="readme" className="border-b px-5 py-3 font-semibold">
        README
      </h2>
      {headings.length > 2 && (
        <nav aria-label="List sections" className="border-b px-5 py-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Sections of this externally maintained list. RepoAtlas does not verify its entries.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {headings.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`} className="rounded-full border px-2.5 py-0.5 text-xs hover:border-primary/60">
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {/* Sanitized server-side by sanitizeReadme (allow-list; no scripts, styles or event handlers). */}
      <div className="readme px-5 py-4 text-[0.95rem]" dangerouslySetInnerHTML={{ __html: readme.html }} />
    </section>
  );
}

async function Related({ repo }: { repo: RepositoryDetails }) {
  const topics = repo.topics.filter((t) => !["awesome", "awesome-list", "hacktoberfest"].includes(t)).slice(0, 2);
  if (topics.length === 0 && !repo.language) return null;
  const spec = searchSpecSchema.parse({
    topic: topics.slice(0, 1),
    language: repo.language && topics.length === 0 ? [repo.language] : [],
    q: topics.length > 1 ? topics[1] : "",
    sort: "stars",
    archived: "exclude",
    perPage: 10,
  });
  let result;
  try {
    result = await searchRepositories(spec);
  } catch (e) {
    rethrowFrameworkErrors(e);
    return null;
  }
  const items = result.items.filter((r) => r.providerId !== repo.providerId).slice(0, 5);
  if (items.length === 0) return null;
  const now = await requestNow();
  const method =
    topics.length > 1
      ? `Most-starred repositories tagged “${topics[0]}” that also mention “${topics[1]}”.`
      : topics.length === 1
        ? `Most-starred repositories tagged “${topics[0]}”.`
        : `Most-starred ${repo.language} repositories.`;
  return (
    <section aria-labelledby="related" className="space-y-3">
      <div>
        <h2 id="related" className="font-semibold">
          Related repositories
        </h2>
        <p className="text-xs text-muted-foreground">{method} Shared tags suggest similar purpose; they are not verified alternatives.</p>
      </div>
      <RepoList label="Related repositories">
        {items.map((r) => (
          <RepoRow key={r.providerId} repo={r} now={now} />
        ))}
      </RepoList>
      <p className="text-xs text-muted-foreground">
        <Link href={`/compare?repos=${[repo.fullName, ...items.slice(0, 2).map((i) => i.fullName)].join(",")}`} className="text-primary hover:underline">
          Compare {repo.name} with the top {Math.min(2, items.length)}
        </Link>{" "}
        ({formatCount(result.totalCount)} matches in total)
      </p>
    </section>
  );
}
