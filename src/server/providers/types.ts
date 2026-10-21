import type { DataFreshness } from "@/lib/cache/cached-fetch";
import type { SearchSpec } from "@/lib/validation/search";
import type {
  CommunityProfile,
  ProviderId,
  RepositoryContributor,
  RepositoryDetails,
  RepositoryRelease,
  RepositorySummary,
} from "@/types/repository";

/** Any provider result, with when/how it was obtained. */
export interface Fetched<T> {
  data: T;
  freshness: DataFreshness;
}

export interface QueryExplanation {
  /** The provider-native query string actually sent (shown in the transparency panel). */
  native: string;
  sort: string;
  order: "asc" | "desc";
  parts: { qualifier: string; explanation: string }[];
}

export interface SearchPage {
  items: RepositorySummary[];
  /** Total matches reported by the provider (may exceed what it lets us page through). */
  totalCount: number;
  /** Provider flagged the result as incomplete (e.g. GitHub search timeout). */
  incomplete: boolean;
  query: QueryExplanation;
}

export interface ContributorsResult {
  contributors: RepositoryContributor[];
  /** True when the provider returned a full page, so the real count may be higher. */
  truncated: boolean;
}

export interface TopicInfo {
  name: string;
  displayName: string | null;
  description: string | null;
  featured: boolean;
}

/**
 * Contract every Git hosting integration implements. Methods return null for data the
 * provider does not have (rather than inventing a value). Capabilities a provider lacks
 * are declared in `capabilities` so the UI can hide or label them.
 */
export interface RepositoryProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly capabilities: {
    commitActivity: boolean;
    communityProfile: boolean;
    topics: boolean;
  };
  search(spec: SearchSpec): Promise<Fetched<SearchPage>>;
  getRepository(owner: string, name: string): Promise<Fetched<RepositoryDetails>>;
  getReadmeHtml(owner: string, name: string): Promise<Fetched<string | null>>;
  getLatestRelease(owner: string, name: string): Promise<Fetched<RepositoryRelease | null>>;
  getContributors(owner: string, name: string): Promise<Fetched<ContributorsResult | null>>;
  getLanguages(owner: string, name: string): Promise<Fetched<Record<string, number> | null>>;
  getCommunityProfile(owner: string, name: string): Promise<Fetched<CommunityProfile | null>>;
  /** Weekly commit totals for the last 52 weeks; null while the provider is computing them. */
  getCommitActivity(owner: string, name: string): Promise<Fetched<{ week: string; commits: number }[] | null>>;
  getTopic(name: string): Promise<Fetched<TopicInfo | null>>;
}
