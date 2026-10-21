import "server-only";
import type { DataFreshness } from "@/lib/cache/cached-fetch";
import { maxPage, type SearchSpec } from "@/lib/validation/search";
import { observeRepositories } from "@/server/analytics/observe";
import { getProvider } from "@/server/providers";
import type { SearchPage } from "@/server/providers/types";

export interface SearchOutcome extends SearchPage {
  spec: SearchSpec;
  freshness: DataFreshness;
  /** Highest page the provider will serve for this query. */
  lastPage: number;
}

/**
 * The one search entry point used by pages, API routes, saved searches and AI search.
 * Results are observed (snapshotted) in the background to build growth history.
 */
export async function searchRepositories(spec: SearchSpec): Promise<SearchOutcome> {
  const result = await getProvider("github").search(spec);
  observeRepositories(result.data.items, result.freshness.fetchedAt, "SEARCH");
  return {
    ...result.data,
    spec,
    freshness: result.freshness,
    lastPage: maxPage(spec.perPage, result.data.totalCount),
  };
}
