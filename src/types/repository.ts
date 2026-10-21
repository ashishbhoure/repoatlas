/**
 * Provider-neutral repository shapes. Every field is either taken directly from a provider
 * response or is null when the provider did not supply it. Nothing here is estimated.
 */
export type ProviderId = "github";

export interface RepositoryLicense {
  /** SPDX identifier, e.g. "MIT". "NOASSERTION" means the provider could not identify it. */
  spdxId: string | null;
  name: string;
}

export interface RepositorySummary {
  provider: ProviderId;
  /** Stable provider identifier (survives renames/transfers). */
  providerId: string;
  owner: string;
  name: string;
  fullName: string;
  ownerAvatarUrl: string | null;
  ownerType: "User" | "Organization" | null;
  description: string | null;
  url: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  /** GitHub counts open issues + open pull requests together in this number. */
  openIssues: number;
  license: RepositoryLicense | null;
  archived: boolean;
  isFork: boolean;
  isTemplate: boolean;
  defaultBranch: string;
  /** Repository size in KB as reported by the provider. */
  sizeKb: number;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
}

export interface RepositoryRelease {
  tagName: string;
  name: string | null;
  url: string;
  publishedAt: string | null;
  prerelease: boolean;
}

export interface RepositoryContributor {
  login: string;
  avatarUrl: string | null;
  url: string | null;
  contributions: number;
}

export interface CommunityProfile {
  /** GitHub's own community-profile percentage (0-100). */
  healthPercentage: number | null;
  hasReadme: boolean;
  hasLicense: boolean;
  hasContributing: boolean;
  hasCodeOfConduct: boolean;
  hasIssueTemplate: boolean;
  hasPullRequestTemplate: boolean;
  hasDescription: boolean;
}

export interface RepositoryDetails extends RepositorySummary {
  subscribers: number | null;
  networkCount: number | null;
  hasIssues: boolean;
  hasWiki: boolean;
  hasDiscussions: boolean;
  visibility: string;
}
