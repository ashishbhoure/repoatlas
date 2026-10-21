import { caught, rethrowFrameworkErrors } from "@/lib/errors/server";
import { requestNow } from "@/lib/request-time";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ErrorState, FreshnessNote, ListSkeleton } from "@/components/feedback/states";
import { LanguageTag } from "@/components/repository/metrics";
import { RepoList, RepoRow } from "@/components/repository/repo-row";
import { categoriesForTopic } from "@/config/topics";
import { formatCount } from "@/lib/format";
import { searchSpecSchema, specToQueryString, type SearchSpecInput } from "@/lib/validation/search";
import { tally } from "@/server/analytics/aggregates";
import { getMeasuredGrowth } from "@/server/analytics/snapshots";
import { getProvider } from "@/server/providers";
import { searchRepositories } from "@/server/repositories/search";

const TOPIC = /^[a-z0-9][a-z0-9-]{0,49}$/;

export async function generateMetadata({ params }: PageProps<"/topics/[topic]">): Promise<Metadata> {
  const { topic } = await params;
  return { title: `${topic} repositories`, description: `Popular and recently updated GitHub repositories tagged ${topic}.` };
}

export default function TopicPage({ params }: PageProps<"/topics/[topic]">) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<ListSkeleton />}>
        <TopicContent params={params} />
      </Suspense>
    </div>
  );
}

async function TopicContent({ params }: Pick<PageProps<"/topics/[topic]">, "params">) {
  const topic = decodeURIComponent((await params).topic).toLowerCase();
  if (!TOPIC.test(topic)) notFound();
  const categories = categoriesForTopic(topic);

  const popular: SearchSpecInput = { topic: [topic], sort: "stars", perPage: 30 };
  const recent: SearchSpecInput = { topic: [topic], pushed: "7d", minStars: 10, sort: "updated", perPage: 10 };

  return (
    <div className="space-y-8">
      <Suspense fallback={<div className="h-20" />}>
        <TopicHeader topic={topic} />
      </Suspense>
      {categories.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Part of{" "}
          {categories.map((c, i) => (
            <span key={c.slug}>
              {i > 0 && ", "}
              <Link href={`/topics/${c.topics[0]}`} className="text-primary hover:underline">
                {c.name}
              </Link>
            </span>
          ))}
          .
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-8">
          <TopicSection title="Most starred" method={`Repositories tagged ${topic}, by stars.`} spec={popular} show={10} topic={topic} ranked />
          <TopicSection title="Recently updated" method="Pushed in the last 7 days, at least 10 stars, most recently updated first." spec={recent} show={10} topic={topic} />
        </div>
        <aside className="space-y-6">
          <Suspense fallback={<ListSkeleton rows={2} />}>
            <TopicSidebar topic={topic} spec={popular} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}

async function TopicHeader({ topic }: { topic: string }) {
  let info = null;
  try {
    info = (await getProvider("github").getTopic(topic)).data;
  } catch (e) {
    rethrowFrameworkErrors(e);
    info = null;
  }
  return (
    <header className="max-w-3xl space-y-1.5">
      <p className="text-sm text-muted-foreground">
        <Link href="/topics" className="hover:underline">
          Topics
        </Link>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{info?.displayName ?? topic}</h1>
      <p className="text-[0.95rem] leading-relaxed text-muted-foreground">
        {info?.description ?? `Repositories whose maintainers tagged them “${topic}” on GitHub.`}
      </p>
      {info?.description && <p className="text-xs text-muted-foreground">Description from GitHub&apos;s topic page{info.featured ? " (featured topic)" : ""}.</p>}
    </header>
  );
}

async function TopicSection(props: { title: string; method: string; spec: SearchSpecInput; show: number; topic: string; ranked?: boolean }) {
  const spec = searchSpecSchema.parse(props.spec);
  let result;
  try {
    result = await searchRepositories(spec);
  } catch (e) {
    return <ErrorState error={caught(e)} retryHref={`/topics/${props.topic}`} />;
  }
  const now = await requestNow();
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{props.title}</h2>
          <p className="text-sm text-muted-foreground">{props.method}</p>
        </div>
        <Link href={`/explore${specToQueryString({ ...spec, perPage: 20 })}`} className="shrink-0 text-sm text-primary hover:underline">
          See all {formatCount(result.totalCount)}
        </Link>
      </div>
      {result.items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No repositories found.</p>
      ) : (
        <RepoList label={props.title}>
          {result.items.slice(0, props.show).map((r, i) => (
            <RepoRow key={r.providerId} repo={r} now={now} rank={props.ranked ? i + 1 : undefined} />
          ))}
        </RepoList>
      )}
      <FreshnessNote freshness={result.freshness} now={now} />
    </section>
  );
}

async function TopicSidebar({ topic, spec }: { topic: string; spec: SearchSpecInput }) {
  let result;
  try {
    result = await searchRepositories(searchSpecSchema.parse(spec));
  } catch (e) {
    rethrowFrameworkErrors(e);
    return null;
  }
  const sample = result.items;
  if (sample.length === 0) return null;
  const languages = tally(sample, (r) => r.language, 6);
  const related = tally(sample, (r) => r.topics.filter((t) => t !== topic), 12);
  const growth = await getMeasuredGrowth({ days: 7, limit: 5, providerRepoIds: sample.map((r) => r.providerId) });
  const growing = growth.filter((g) => g.starsGained > 0);
  return (
    <>
      {growing.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Growing this week</h2>
          <p className="text-xs text-muted-foreground">Measured by RepoAtlas among the {sample.length} most-starred.</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {growing.map((g) => (
              <li key={g.providerRepoId} className="flex justify-between gap-2">
                <Link href={`/repository/${g.fullName}`} className="truncate font-mono text-xs hover:underline">
                  {g.fullName}
                </Link>
                <span className="text-success tabular">+{formatCount(g.starsGained)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Languages</h2>
        <p className="text-xs text-muted-foreground">Primary languages of the {sample.length} most-starred repositories with this topic.</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {languages.map((l) => (
            <li key={l.name} className="flex items-center justify-between gap-2">
              <Link href={`/explore?topic=${topic}&language=${encodeURIComponent(l.name)}&sort=stars`} className="hover:underline">
                <LanguageTag language={l.name} />
              </Link>
              <span className="text-xs text-muted-foreground tabular">{l.count}</span>
            </li>
          ))}
        </ul>
      </section>
      {related.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Related topics</h2>
          <p className="text-xs text-muted-foreground">Tagged alongside {topic} most often in the same sample.</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {related.map((t) => (
              <li key={t.name}>
                <Link href={`/topics/${t.name}`} className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground hover:bg-primary/15">
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
