import { caught } from "@/lib/errors/server";
import { requestNow } from "@/lib/request-time";
import Link from "next/link";
import { EmptyState, ErrorState, FreshnessNote } from "@/components/feedback/states";
import { RepoList, RepoRow } from "@/components/repository/repo-row";
import { SaveRepositoryButton } from "@/components/repository/save-button";
import { formatNumber } from "@/lib/format";
import { MAX_SEARCH_RESULTS, specToQueryString, type SearchSpec } from "@/lib/validation/search";
import { getLibraryState } from "@/server/collections/library";
import { searchRepositories, type SearchOutcome } from "@/server/repositories/search";
import { Pagination } from "./pagination";
import { QueryPanel } from "./query-panel";

interface Props {
  spec: SearchSpec;
  basePath: string;
  /** Show rank numbers (for ranking views such as Most Starred). */
  ranked?: boolean;
  emptyHint?: React.ReactNode;
}

/** Runs a search and renders the full result block. Errors render as a recoverable panel. */
export async function SearchResults({ spec, basePath, ranked, emptyHint }: Props) {
  let result: SearchOutcome;
  try {
    result = await searchRepositories(spec);
  } catch (e) {
    return <ErrorState error={caught(e)} retryHref={`${basePath}${specToQueryString(spec)}`} />;
  }
  const now = await requestNow();
  const library = await getLibraryState(result.items.map((r) => r.providerId));
  const first = (spec.page - 1) * spec.perPage + 1;
  const last = first + result.items.length - 1;

  return (
    <section className="space-y-4" aria-label="Search results">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm" data-testid="result-count">
          {result.totalCount === 0 ? (
            "No repositories match"
          ) : (
            <>
              <span className="font-medium tabular">{formatNumber(result.totalCount)}</span>{" "}
              {result.totalCount === 1 ? "repository" : "repositories"}
              {result.items.length > 0 && (
                <span className="text-muted-foreground">
                  {", "}
                  showing {formatNumber(first)}–{formatNumber(last)}
                </span>
              )}
            </>
          )}
        </p>
        <FreshnessNote freshness={result.freshness} now={now} />
      </div>

      {result.incomplete && (
        <p className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
          GitHub reported that this search timed out before checking every repository, so some matches may be missing.
        </p>
      )}

      {result.items.length === 0 ? (
        <EmptyState title="No repositories match this search">
          {emptyHint ?? (
            <p>
              Try fewer filters, a lower star minimum, or a broader date range.{" "}
              <Link href={basePath} className="text-primary hover:underline">
                Start over
              </Link>
            </p>
          )}
        </EmptyState>
      ) : (
        <RepoList label="Repositories">
          {result.items.map((repo, i) => (
            <RepoRow
              key={repo.providerId}
              repo={repo}
              now={now}
              rank={ranked ? first + i : undefined}
              actions={
                library.enabled ? (
                  <SaveRepositoryButton
                    repo={{ providerId: repo.providerId, fullName: repo.fullName }}
                    initiallySaved={library.savedIds.has(repo.providerId)}
                    signedIn={library.signedIn}
                  />
                ) : undefined
              }
            />
          ))}
        </RepoList>
      )}

      <Pagination spec={spec} lastPage={result.lastPage} basePath={basePath} />
      {result.totalCount > MAX_SEARCH_RESULTS && result.lastPage === Math.ceil(MAX_SEARCH_RESULTS / spec.perPage) && (
        <p className="text-center text-xs text-muted-foreground">
          GitHub serves only the first {formatNumber(MAX_SEARCH_RESULTS)} results of any search. Narrow the filters to
          reach the rest.
        </p>
      )}
      <QueryPanel query={result.query} />
    </section>
  );
}
