import { z } from "zod";
import type { CachePolicy } from "@/lib/cache/cached-fetch";
import { AppError } from "@/lib/errors";
import type { SearchSpec } from "@/lib/validation/search";
import type { ContributorsResult, Fetched, RepositoryProvider } from "../types";
import type { GitHubClient } from "./client";
import {
  normalizeCommunityProfile,
  normalizeContributors,
  normalizeRelease,
  normalizeRepository,
  normalizeRepositoryDetails,
} from "./normalize";
import { buildGitHubQuery } from "./query";
import {
  ghCommitActivity,
  ghCommunityProfile,
  ghContributors,
  ghLanguages,
  ghRelease,
  ghRepository,
  ghSearchResponse,
  ghTopicSearch,
} from "./schemas";

const MIN = 60;
const HOUR = 3600;
const DAY = 86_400;

/** Freshness budget per endpoint, chosen from how quickly the underlying data changes. */
export const POLICIES = {
  search: { freshSeconds: 10 * MIN, maxAgeSeconds: DAY },
  repository: { freshSeconds: 30 * MIN, maxAgeSeconds: 7 * DAY },
  readme: { freshSeconds: 6 * HOUR, maxAgeSeconds: 7 * DAY },
  release: { freshSeconds: HOUR, maxAgeSeconds: 7 * DAY },
  contributors: { freshSeconds: 6 * HOUR, maxAgeSeconds: 7 * DAY },
  languages: { freshSeconds: DAY, maxAgeSeconds: 30 * DAY },
  community: { freshSeconds: DAY, maxAgeSeconds: 30 * DAY },
  commitActivity: { freshSeconds: 6 * HOUR, maxAgeSeconds: 7 * DAY },
  topic: { freshSeconds: DAY, maxAgeSeconds: 30 * DAY },
} satisfies Record<string, CachePolicy>;

const segment = z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/);

function repoPath(owner: string, name: string) {
  const valid = (v: string) => segment.safeParse(v).success && !/^\.+$/.test(v);
  if (!valid(owner) || !valid(name)) {
    throw new AppError("INVALID_INPUT", "That is not a valid repository name.");
  }
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

function wrap<T>(r: { value: T | null; freshness: Fetched<T>["freshness"] }): Fetched<T | null> {
  return { data: r.value, freshness: r.freshness };
}

export class GitHubProvider implements RepositoryProvider {
  readonly id = "github" as const;
  readonly displayName = "GitHub";
  readonly capabilities = { commitActivity: true, communityProfile: true, topics: true };

  constructor(private readonly client: GitHubClient) {}

  async search(spec: SearchSpec) {
    const built = buildGitHubQuery(spec);
    const r = await this.client.get("/search/repositories", {
      query: {
        q: built.q,
        sort: built.sort,
        order: built.sort ? built.order : undefined,
        per_page: spec.perPage,
        page: spec.page,
      },
      schema: ghSearchResponse,
      transform: (d) => ({
        items: d.items.map(normalizeRepository),
        totalCount: d.total_count,
        incomplete: d.incomplete_results,
      }),
      policy: POLICIES.search,
    });
    if (!r.value) throw new AppError("UPSTREAM_BAD_RESPONSE", "GitHub returned no search results payload.");
    return {
      data: {
        ...r.value,
        query: {
          native: built.q,
          sort: built.sort ?? "best match",
          order: built.order,
          parts: built.parts,
        },
      },
      freshness: r.freshness,
    };
  }

  async getRepository(owner: string, name: string) {
    const r = await this.client.get(repoPath(owner, name), {
      schema: ghRepository,
      transform: normalizeRepositoryDetails,
      policy: POLICIES.repository,
    });
    if (!r.value) throw new AppError("NOT_FOUND", "That repository was not found on GitHub.");
    return { data: r.value, freshness: r.freshness };
  }

  async getReadmeHtml(owner: string, name: string) {
    return wrap(
      await this.client.get(`${repoPath(owner, name)}/readme`, {
        accept: "application/vnd.github.html",
        schema: z.string().max(2_000_000),
        transform: (html) => html,
        policy: POLICIES.readme,
        allowNotFound: true,
      }),
    );
  }

  async getLatestRelease(owner: string, name: string) {
    return wrap(
      await this.client.get(`${repoPath(owner, name)}/releases/latest`, {
        schema: ghRelease,
        transform: normalizeRelease,
        policy: POLICIES.release,
        allowNotFound: true,
      }),
    );
  }

  async getContributors(owner: string, name: string): Promise<Fetched<ContributorsResult | null>> {
    const perPage = 100;
    try {
      return wrap(
        await this.client.get(`${repoPath(owner, name)}/contributors`, {
          query: { per_page: perPage },
          schema: ghContributors,
          transform: (list) => ({ contributors: normalizeContributors(list), truncated: list.length >= perPage }),
          policy: POLICIES.contributors,
          allowNotFound: true,
          allowAccepted: true,
        }),
      );
    } catch (e) {
      // GitHub refuses contributor lists for very large repositories; treat as unavailable.
      if (e instanceof AppError && e.code === "UPSTREAM_UNAVAILABLE") {
        return { data: null, freshness: { fetchedAt: new Date().toISOString(), cache: "miss" } };
      }
      throw e;
    }
  }

  async getLanguages(owner: string, name: string) {
    return wrap(
      await this.client.get(`${repoPath(owner, name)}/languages`, {
        schema: ghLanguages,
        transform: (l) => l,
        policy: POLICIES.languages,
        allowNotFound: true,
      }),
    );
  }

  async getCommunityProfile(owner: string, name: string) {
    return wrap(
      await this.client.get(`${repoPath(owner, name)}/community/profile`, {
        schema: ghCommunityProfile,
        transform: normalizeCommunityProfile,
        policy: POLICIES.community,
        allowNotFound: true,
      }),
    );
  }

  async getCommitActivity(owner: string, name: string) {
    return wrap(
      await this.client.get(`${repoPath(owner, name)}/stats/commit_activity`, {
        schema: ghCommitActivity,
        transform: (weeks) =>
          weeks.map((w) => ({ week: new Date(w.week * 1000).toISOString().slice(0, 10), commits: w.total })),
        policy: POLICIES.commitActivity,
        allowNotFound: true,
        allowAccepted: true,
      }),
    );
  }

  async getTopic(name: string) {
    if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(name)) {
      throw new AppError("INVALID_INPUT", "That is not a valid topic name.");
    }
    return wrap(
      await this.client.get("/search/topics", {
        query: { q: name, per_page: 5 },
        schema: ghTopicSearch,
        transform: (d) => {
          const t = d.items.find((i) => i.name === name);
          if (!t) return null;
          return {
            name: t.name,
            displayName: t.display_name,
            description: t.short_description ?? t.description,
            featured: Boolean(t.featured),
          };
        },
        policy: POLICIES.topic,
      }),
    );
  }
}

