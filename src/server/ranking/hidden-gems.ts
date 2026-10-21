import type { RepositorySummary } from "@/types/repository";

/**
 * Hidden Gems ranking, version 1. Specification: docs/RANKING.md#hidden-gems.
 *
 * Candidates come from a provider query restricted to a modest star band, recent pushes,
 * no forks and no archived repositories. This module then ranks that candidate set locally;
 * it never claims a global ranking. Star count itself is not a scoring input, so the list
 * is not just "low-star repositories sorted by stars".
 */
export const HIDDEN_GEMS_VERSION = "hidden-gems@1";

export const HIDDEN_GEM_BAND = { minStars: 20, maxStars: 1500 } as const;

export interface GemFactor {
  key: "maintenance" | "engagement" | "documentation" | "momentum";
  label: string;
  weight: number;
  score: number | null;
  detail: string;
}

export interface GemScore {
  version: string;
  score: number;
  factors: GemFactor[];
}

export interface RankedGem {
  repo: RepositorySummary;
  gem: GemScore;
}

const DAY = 86_400_000;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function scoreHiddenGem(
  repo: RepositorySummary,
  opts: { now?: number; starsPerDay?: number | null } = {},
): GemScore {
  const now = opts.now ?? Date.now();
  const factors: GemFactor[] = [];

  const pushedDays = repo.pushedAt ? Math.max(0, (now - Date.parse(repo.pushedAt)) / DAY) : null;
  factors.push({
    key: "maintenance",
    label: "Recent maintenance",
    weight: 0.35,
    score: pushedDays === null ? null : clamp(Math.pow(0.5, pushedDays / 21)),
    detail: pushedDays === null ? "No push date reported." : `Last push ${Math.floor(pushedDays)} days ago (score halves every 21 days).`,
  });

  const ratio = repo.stars > 0 ? repo.forks / repo.stars : 0;
  factors.push({
    key: "engagement",
    label: "Hands-on engagement",
    weight: 0.25,
    score: clamp(ratio / 0.25),
    detail: `${repo.forks} forks per ${repo.stars} stars (ratio ${ratio.toFixed(2)}; full score at ≥ 0.25). Forks suggest people build on it.`,
  });

  const docParts: [boolean, number, string][] = [
    [Boolean(repo.description), 0.4, "description"],
    [Boolean(repo.license?.spdxId && repo.license.spdxId !== "NOASSERTION"), 0.2, "license"],
    [repo.topics.length >= 3, 0.2, "3+ topics"],
    [Boolean(repo.homepage), 0.2, "homepage"],
  ];
  factors.push({
    key: "documentation",
    label: "Presentation",
    weight: 0.2,
    score: docParts.reduce((s, [has, w]) => s + (has ? w : 0), 0),
    detail: `Has: ${docParts.filter(([h]) => h).map(([, , n]) => n).join(", ") || "none of description, license, topics, homepage"}.`,
  });

  const spd = opts.starsPerDay;
  factors.push({
    key: "momentum",
    label: "Measured momentum",
    weight: 0.2,
    score: spd === undefined || spd === null ? null : clamp(Math.log10(1 + Math.max(0, spd) * 7) / 2),
    detail:
      spd === undefined || spd === null
        ? "Not yet measured: RepoAtlas needs two observations at least 20 hours apart."
        : `${spd.toFixed(1)} stars/day measured by RepoAtlas (full score at ≈ 14/day).`,
  });

  const available = factors.filter((f) => f.score !== null);
  const weight = available.reduce((s, f) => s + f.weight, 0);
  const score = weight === 0 ? 0 : available.reduce((s, f) => s + f.weight * (f.score as number), 0) / weight;

  return { version: HIDDEN_GEMS_VERSION, score: Math.round(score * 100), factors };
}

export function rankHiddenGems(
  candidates: RepositorySummary[],
  opts: { now?: number; growth?: Map<string, number> } = {},
): RankedGem[] {
  return candidates
    .filter(
      (r) =>
        !r.archived &&
        !r.isFork &&
        r.stars >= HIDDEN_GEM_BAND.minStars &&
        r.stars <= HIDDEN_GEM_BAND.maxStars,
    )
    .map((repo) => ({
      repo,
      gem: scoreHiddenGem(repo, { now: opts.now, starsPerDay: opts.growth?.get(repo.providerId) ?? null }),
    }))
    .sort((a, b) => b.gem.score - a.gem.score || a.repo.fullName.localeCompare(b.repo.fullName));
}
