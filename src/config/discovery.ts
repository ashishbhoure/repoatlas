import type { SearchSpecInput } from "@/lib/validation/search";

/**
 * Discovery views are named presets over the regular search spec. Each one states exactly
 * what it measures, so labels never overclaim (e.g. no "trending" without measured growth).
 * User-selected filters are layered on top of `base`; `locked` keys cannot be overridden.
 */
export interface DiscoveryView {
  slug: string;
  title: string;
  short: string;
  /** Plain-language statement of what the list is, shown on the page. */
  method: string;
  base: SearchSpecInput;
  locked: (keyof SearchSpecInput)[];
  caveat?: string;
}

export const DISCOVERY_VIEWS = {
  "most-starred": {
    slug: "most-starred",
    title: "Most Starred",
    short: "Highest star counts",
    method: "Public repositories sorted by GitHub star count, highest first.",
    base: { sort: "stars" },
    locked: ["sort"],
  },
  "most-forked": {
    slug: "most-forked",
    title: "Most Forked",
    short: "Most widely reused",
    method: "Public repositories sorted by fork count. Forks indicate people copying a project to build on or modify it.",
    base: { sort: "forks" },
    locked: ["sort"],
  },
  "recently-updated": {
    slug: "recently-updated",
    title: "Recently Updated",
    short: "Latest activity",
    method: "Repositories with at least 100 stars and a push in the last 7 days, sorted by GitHub's last-updated time.",
    base: { sort: "updated", pushed: "7d", minStars: 100 },
    locked: ["sort"],
    caveat:
      "GitHub's \"updated\" time changes for metadata events too (for example when someone stars the repository), so a recent update does not always mean new code. The push filter narrows results to repositories that received commits.",
  },
  "recently-created": {
    slug: "recently-created",
    title: "Recently Created",
    short: "New projects",
    method: "Repositories created in the selected window, sorted by star count.",
    base: { sort: "stars", created: "30d" },
    locked: ["sort"],
    caveat: "GitHub's API cannot sort by creation date, so new repositories are filtered by creation window and ordered by stars.",
  },
} satisfies Record<string, DiscoveryView>;

export type DiscoverySlug = keyof typeof DISCOVERY_VIEWS;

/** Windows offered on the Trending page's "new & notable" fallback list. */
export const NEW_AND_NOTABLE_WINDOWS = [
  { value: "7d", label: "Created in the last 7 days" },
  { value: "30d", label: "Created in the last 30 days" },
  { value: "90d", label: "Created in the last 90 days" },
] as const;
