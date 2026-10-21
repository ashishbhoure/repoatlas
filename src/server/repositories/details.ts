import "server-only";
import { connection } from "next/server";
import type { DataFreshness } from "@/lib/cache/cached-fetch";
import { isAppError } from "@/lib/errors";
import { rethrowFrameworkErrors } from "@/lib/errors/server";
import { sanitizeReadme } from "@/lib/markdown/sanitize-readme";
import { log } from "@/lib/observability/logger";
import { observeRepositories } from "@/server/analytics/observe";
import { getProvider } from "@/server/providers";
import type { ContributorsResult } from "@/server/providers/types";
import { computeHealthScore, type HealthScore } from "@/server/ranking/health";
import type { CommunityProfile, RepositoryDetails, RepositoryRelease } from "@/types/repository";

/**
 * Secondary data for a repository. `undefined` means "could not be fetched right now",
 * `null` means "the provider says this does not exist" (e.g. no releases).
 */
export interface RepositoryOverview {
  repo: RepositoryDetails;
  freshness: DataFreshness;
  latestRelease: RepositoryRelease | null | undefined;
  contributors: ContributorsResult | null | undefined;
  community: CommunityProfile | null | undefined;
  languages: Record<string, number> | null | undefined;
  commitActivity: { week: string; commits: number }[] | null | undefined;
  health: HealthScore;
}

async function optional<T>(label: string, p: Promise<{ data: T }>): Promise<T | undefined> {
  try {
    return (await p).data;
  } catch (e) {
    rethrowFrameworkErrors(e);
    log.warn("repository.optional_failed", { label, code: isAppError(e) ? e.code : "unknown" });
    return undefined;
  }
}

/** Core repository metadata plus everything needed for the health score. Throws NOT_FOUND. */
export async function getRepositoryOverview(owner: string, name: string): Promise<RepositoryOverview> {
  await connection();
  const provider = getProvider("github");
  const { data: repo, freshness } = await provider.getRepository(owner, name);

  // Use canonical owner/name (handles case differences and renames via redirect).
  const [o, n] = [repo.owner, repo.name];
  const [latestRelease, contributors, community, languages, commitActivity] = await Promise.all([
    optional("release", provider.getLatestRelease(o, n)),
    optional("contributors", provider.getContributors(o, n)),
    optional("community", provider.getCommunityProfile(o, n)),
    optional("languages", provider.getLanguages(o, n)),
    optional("commitActivity", provider.getCommitActivity(o, n)),
  ]);

  observeRepositories([repo], freshness.fetchedAt, "DETAILS");

  const health = computeHealthScore({
    repo,
    latestRelease,
    community,
    contributors: contributors
      ? { count: contributors.contributors.length, truncated: contributors.truncated }
      : contributors,
    commitActivity,
  });

  return { repo, freshness, latestRelease, contributors, community, languages, commitActivity, health };
}

/** Lightweight variant for search results / comparison headers. Throws NOT_FOUND. */
export async function getRepositorySummary(owner: string, name: string) {
  return getProvider("github").getRepository(owner, name);
}

/** Sanitized README HTML, or null when the repository has none. */
export async function getSanitizedReadme(repo: RepositoryDetails): Promise<{ html: string | null; freshness: DataFreshness }> {
  const r = await getProvider("github").getReadmeHtml(repo.owner, repo.name);
  return {
    html: r.data ? sanitizeReadme(r.data, { owner: repo.owner, name: repo.name, branch: repo.defaultBranch }) : null,
    freshness: r.freshness,
  };
}
