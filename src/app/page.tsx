import { requestNow } from "@/lib/request-time";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ErrorState, FreshnessNote, ListSkeleton } from "@/components/feedback/states";
import { Contours } from "@/components/layout/contours";
import { LanguageTag } from "@/components/repository/metrics";
import { RepoList, RepoRow } from "@/components/repository/repo-row";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { toAppError } from "@/lib/errors";
import { formatCount } from "@/lib/format";
import { searchSpecSchema, type SearchSpecInput } from "@/lib/validation/search";
import { tally } from "@/server/analytics/aggregates";
import { getMeasuredGrowth } from "@/server/analytics/snapshots";
import { listCollections } from "@/server/collections/library";
import { searchRepositories } from "@/server/repositories/search";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <Hero />
      <Suspense fallback={null}>
        <MeasuredTrending />
      </Suspense>
      <div className="grid gap-8 lg:grid-cols-2">
        <Section
          title="New and attracting attention"
          method="Most-starred repositories created in the last 30 days."
          href="/recently-created"
          spec={{ created: "30d", sort: "stars", perPage: 50 }}
        />
        <Section
          title="Most starred"
          method="The highest star counts on GitHub."
          href="/most-starred"
          spec={{ sort: "stars", perPage: 50 }}
        />
        <Section
          title="Recently updated"
          method="Repositories with 1,000+ stars and a push in the last 24 hours."
          href="/recently-updated"
          spec={{ pushed: "24h", minStars: 1000, sort: "updated", perPage: 50 }}
        />
        <div className="space-y-8">
          <Section
            title="Popular languages"
            method="Primary languages of the 50 most-starred repositories on GitHub."
            href="/most-starred"
            spec={{ sort: "stars", perPage: 50 }}
            aside="languages"
          />
          <Section
            title="Topics new projects use"
            method="Most common topics among the 50 most-starred repositories created in the last 30 days."
            href="/topics"
            spec={{ created: "30d", sort: "stars", perPage: 50 }}
            aside="topics"
          />
        </div>
      </div>
      <Suspense fallback={null}>
        <CollectionsQuickAccess />
      </Suspense>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-xl border bg-card px-6 py-10 sm:px-10 sm:py-14">
      <Contours className="pointer-events-none absolute inset-y-0 right-0 h-full w-full text-contour sm:w-2/3" />
      <div className="relative max-w-2xl">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-[2.6rem]">
          Find open-source projects worth building on.
        </h1>
        <p className="mt-3 max-w-xl text-[1.02rem] leading-relaxed text-muted-foreground">
          Search every public GitHub repository, filter by language, topic, license and activity, and compare projects
          with scores that show how they were calculated.
        </p>
        <form action="/explore" method="get" role="search" className="mt-6 flex max-w-xl gap-2">
          <label htmlFor="home-q" className="sr-only">
            Search repositories
          </label>
          <input
            id="home-q"
            name="q"
            maxLength={200}
            required
            placeholder="Try “vector database” or “react state management”"
            className="h-12 min-w-0 flex-1 rounded-md border border-input bg-background px-4 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            data-testid="home-search"
          />
          <Button type="submit" className="h-12 px-5 text-base">
            Search
          </Button>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          Or browse <Link className="text-primary hover:underline" href="/trending">trending</Link>,{" "}
          <Link className="text-primary hover:underline" href="/hidden-gems">hidden gems</Link> and{" "}
          <Link className="text-primary hover:underline" href="/topics">topics</Link>.
        </p>
      </div>
    </section>
  );
}

function Section(props: { title: string; method: string; href: string; spec: SearchSpecInput; aside?: "languages" | "topics" }) {
  return (
    <section className="space-y-3" aria-labelledby={`h-${props.href}-${props.aside ?? ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id={`h-${props.href}-${props.aside ?? ""}`} className="text-lg font-semibold tracking-tight">
            {props.title}
          </h2>
          <p className="text-sm text-muted-foreground">{props.method}</p>
        </div>
        <Link href={props.href} className="shrink-0 text-sm text-primary hover:underline">
          See all
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton rows={props.aside ? 3 : 5} />}>
        <SectionBody spec={props.spec} aside={props.aside} />
      </Suspense>
    </section>
  );
}

async function SectionBody({ spec, aside }: { spec: SearchSpecInput; aside?: "languages" | "topics" }) {
  await connection();
  let result;
  try {
    result = await searchRepositories(searchSpecSchema.parse(spec));
  } catch (e) {
    return <ErrorState error={toAppError(e)} retryHref="/" />;
  }
  const now = requestNow();
  {
    if (aside) {
      const rows =
        aside === "languages"
          ? tally(result.items, (r) => r.language, 8)
          : tally(result.items, (r) => r.topics, 12);
      return (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          <ul className={aside === "languages" ? "space-y-1.5" : "flex flex-wrap gap-2"}>
            {rows.map((t) =>
              aside === "languages" ? (
                <li key={t.name} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm">
                  <Link href={`/most-starred?language=${encodeURIComponent(t.name)}`} className="truncate hover:underline">
                    <LanguageTag language={t.name} />
                  </Link>
                  <span className="h-1.5 rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(t.share * 100)}%` }} />
                  </span>
                  <span className="text-right text-xs text-muted-foreground tabular">{t.count}</span>
                </li>
              ) : (
                <li key={t.name}>
                  <Link href={`/topics/${t.name}`} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm hover:border-primary/60">
                    {t.name}
                    <span className="text-xs text-muted-foreground tabular">{t.count}</span>
                  </Link>
                </li>
              ),
            )}
          </ul>
          <FreshnessNote freshness={result.freshness} now={now} />
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <RepoList label="Repositories">
          {result.items.slice(0, 5).map((r) => (
            <RepoRow key={r.providerId} repo={r} now={now} />
          ))}
        </RepoList>
        <FreshnessNote freshness={result.freshness} now={now} />
      </div>
    );
  }
}

/** Only rendered once RepoAtlas has measured growth between two observations. */
async function MeasuredTrending() {
  await connection();
  const rows = await getMeasuredGrowth({ days: 7, limit: 6 });
  const growing = rows.filter((r) => r.starsGained > 0);
  if (growing.length === 0) return null;
  return (
    <section className="space-y-3" aria-labelledby="measured">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 id="measured" className="text-lg font-semibold tracking-tight">
            Fastest growing this week
          </h2>
          <p className="text-sm text-muted-foreground">Star growth measured by RepoAtlas between its own observations.</p>
        </div>
        <Link href="/trending" className="text-sm text-primary hover:underline">
          See all
        </Link>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {growing.map((g) => (
          <li key={g.providerRepoId}>
            <Link href={`/repository/${g.fullName}`} className="block rounded-lg border bg-card px-4 py-3 hover:border-primary/50">
              <span className="block truncate font-mono text-sm">{g.fullName}</span>
              <span className="mt-1 block text-sm">
                <span className="font-medium text-success tabular">+{formatCount(g.starsGained)}</span>{" "}
                <span className="text-muted-foreground">stars, {g.starsPerDay.toFixed(1)}/day</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function CollectionsQuickAccess() {
  const user = await getCurrentUser();
  if (!user) return null;
  const collections = (await listCollections(user.id)).slice(0, 6);
  return (
    <section className="space-y-3" aria-labelledby="your-collections">
      <div className="flex items-baseline justify-between">
        <h2 id="your-collections" className="text-lg font-semibold tracking-tight">
          Your collections
        </h2>
        <Link href="/collections" className="text-sm text-primary hover:underline">
          Manage
        </Link>
      </div>
      {collections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have no collections yet. <Link href="/collections" className="text-primary hover:underline">Create one</Link> to group repositories.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <li key={c.id}>
              <Link href={`/collections/${c.id}`} className="block rounded-lg border bg-card px-4 py-3 hover:border-primary/50">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="text-sm text-muted-foreground">{c._count.items} repositories</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
