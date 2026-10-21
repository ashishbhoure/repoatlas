import type { z } from "zod";
import type {
  CommunityProfile,
  RepositoryContributor,
  RepositoryDetails,
  RepositoryRelease,
  RepositorySummary,
} from "@/types/repository";
import type { ghCommunityProfile, ghContributors, ghRelease, GhRepository } from "./schemas";

function emptyToNull(s: string | null | undefined): string | null {
  return s && s.trim() !== "" ? s : null;
}

export function normalizeRepository(r: GhRepository): RepositorySummary {
  const ownerType = r.owner.type === "Organization" ? "Organization" : r.owner.type === "User" ? "User" : null;
  return {
    provider: "github",
    providerId: String(r.id),
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    ownerAvatarUrl: emptyToNull(r.owner.avatar_url),
    ownerType,
    description: emptyToNull(r.description),
    url: r.html_url,
    homepage: emptyToNull(r.homepage),
    language: emptyToNull(r.language),
    topics: r.topics,
    stars: r.stargazers_count,
    forks: r.forks_count,
    openIssues: r.open_issues_count,
    license: r.license
      ? { spdxId: r.license.spdx_id ?? null, name: r.license.name }
      : null,
    archived: r.archived,
    isFork: r.fork,
    isTemplate: r.is_template,
    defaultBranch: r.default_branch,
    sizeKb: r.size,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    pushedAt: emptyToNull(r.pushed_at),
  };
}

export function normalizeRepositoryDetails(r: GhRepository): RepositoryDetails {
  return {
    ...normalizeRepository(r),
    subscribers: r.subscribers_count ?? null,
    networkCount: r.network_count ?? null,
    hasIssues: r.has_issues ?? true,
    hasWiki: r.has_wiki ?? false,
    hasDiscussions: r.has_discussions ?? false,
    visibility: r.visibility ?? "public",
  };
}

export function normalizeRelease(r: z.infer<typeof ghRelease>): RepositoryRelease {
  return {
    tagName: r.tag_name,
    name: emptyToNull(r.name),
    url: r.html_url,
    publishedAt: r.published_at,
    prerelease: r.prerelease,
  };
}

export function normalizeContributors(list: z.infer<typeof ghContributors>): RepositoryContributor[] {
  return list
    .filter((c) => c.type !== "Anonymous" && c.login)
    .map((c) => ({
      login: c.login!,
      avatarUrl: c.avatar_url,
      url: c.html_url,
      contributions: c.contributions,
    }));
}

export function normalizeCommunityProfile(p: z.infer<typeof ghCommunityProfile>): CommunityProfile {
  const f = p.files;
  return {
    healthPercentage: p.health_percentage ?? null,
    hasReadme: Boolean(f.readme),
    hasLicense: Boolean(f.license),
    hasContributing: Boolean(f.contributing),
    hasCodeOfConduct: Boolean(f.code_of_conduct || f.code_of_conduct_file),
    hasIssueTemplate: Boolean(f.issue_template),
    hasPullRequestTemplate: Boolean(f.pull_request_template),
    hasDescription: Boolean(p.description && p.description.trim()),
  };
}
