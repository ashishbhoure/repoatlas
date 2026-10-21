import "server-only";
import { env } from "@/config/env";
import { appCache } from "@/lib/cache";
import type { ProviderId } from "@/types/repository";
import { GitHubClient } from "./github/client";
import { GitHubProvider } from "./github/provider";
import type { RepositoryProvider } from "./types";

const globalForProviders = globalThis as unknown as {
  repoAtlasProviders?: Map<ProviderId, RepositoryProvider>;
};

function build(id: ProviderId): RepositoryProvider {
  switch (id) {
    case "github": {
      const e = env();
      const client = new GitHubClient({ baseUrl: e.GITHUB_API_URL, token: e.GITHUB_TOKEN, store: appCache() });
      return new GitHubProvider(client);
    }
  }
}

/** Returns the provider for an id. New hosting platforms are added to `build` only. */
export function getProvider(id: ProviderId = "github"): RepositoryProvider {
  globalForProviders.repoAtlasProviders ??= new Map();
  let p = globalForProviders.repoAtlasProviders.get(id);
  if (!p) {
    p = build(id);
    globalForProviders.repoAtlasProviders.set(id, p);
  }
  return p;
}

export const SUPPORTED_PROVIDERS: { id: ProviderId; name: string; available: boolean }[] = [
  { id: "github", name: "GitHub", available: true },
];
