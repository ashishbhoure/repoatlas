import type {
  CommunityProfile,
  RepositoryDetails,
  RepositoryRelease,
} from "@/types/repository";

/**
 * Repository Health Score, version 1. Specification: docs/RANKING.md#health-score.
 *
 * Each dimension maps real provider data to [0, 1]. Dimensions whose data is unavailable
 * are excluded and the remaining weights are re-normalised; the result reports how much of
 * the total weight was covered so the UI can label low-coverage scores as provisional.
 * Raw open-issue counts are deliberately not used: they scale with popularity, not quality.
 */
export const HEALTH_VERSION = "health@1";

export type HealthDimensionKey =
  | "maintenance"
  | "activity"
  | "releases"
  | "adoption"
  | "community"
  | "license"
  | "contributors";

export interface HealthDimension {
  key: HealthDimensionKey;
  label: string;
  weight: number;
  /** 0–1, or null when the input data was unavailable. */
  score: number | null;
  detail: string;
}

export interface HealthScore {
  version: string;
  /** 0–100, or null when coverage is insufficient. */
  score: number | null;
  status: "ok" | "provisional" | "insufficient";
  /** Fraction (0–1) of total weight backed by available data. */
  coverage: number;
  archived: boolean;
  dimensions: HealthDimension[];
  computedAt: string;
}

export interface HealthInputs {
  repo: RepositoryDetails;
  /** undefined = could not be fetched; null = repository has no releases. */
  latestRelease: RepositoryRelease | null | undefined;
  community: CommunityProfile | null | undefined;
  contributors: { count: number; truncated: boolean } | null | undefined;
  /** Weekly commit totals, oldest first; null/undefined when unavailable. */
  commitActivity: { week: string; commits: number }[] | null | undefined;
  now?: number;
}

export const HEALTH_WEIGHTS: Record<HealthDimensionKey, number> = {
  maintenance: 25,
  activity: 15,
  releases: 10,
  adoption: 20,
  community: 15,
  license: 10,
  contributors: 5,
};

const DAY = 86_400_000;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** 1 at or below `full` days, falling linearly to 0 at `zero` days. */
export function ageScore(days: number, full: number, zero: number): number {
  if (days <= full) return 1;
  if (days >= zero) return 0;
  return 1 - (days - full) / (zero - full);
}

export function computeHealthScore(input: HealthInputs): HealthScore {
  const now = input.now ?? Date.now();
  const { repo } = input;
  const dims: HealthDimension[] = [];
  const add = (key: HealthDimensionKey, label: string, score: number | null, detail: string) =>
    dims.push({ key, label, weight: HEALTH_WEIGHTS[key], score: score === null ? null : clamp(score), detail });

  // Maintenance: recency of the last push.
  if (repo.archived) {
    add("maintenance", "Maintenance", 0, "Repository is archived (read-only).");
  } else if (repo.pushedAt) {
    const days = Math.floor((now - Date.parse(repo.pushedAt)) / DAY);
    add("maintenance", "Maintenance", ageScore(days, 14, 365), `Last push ${days} day${days === 1 ? "" : "s"} ago (full score ≤ 14 days, zero at 365).`);
  } else {
    add("maintenance", "Maintenance", null, "No push date reported.");
  }

  // Activity: commits on the default branch over the last 12 weeks.
  if (input.commitActivity && input.commitActivity.length > 0) {
    const recent = input.commitActivity.slice(-12).reduce((s, w) => s + w.commits, 0);
    const score = repo.archived ? 0 : Math.log10(1 + recent) / Math.log10(1 + 120);
    add("activity", "Commit activity", score, `${recent} commit${recent === 1 ? "" : "s"} in the last 12 weeks (full score at ≥ 120).`);
  } else {
    add("activity", "Commit activity", null, "Commit statistics unavailable (GitHub may still be computing them).");
  }

  // Releases: age of the latest published release. No releases → not scored.
  if (input.latestRelease === undefined) {
    add("releases", "Release cadence", null, "Release data could not be fetched.");
  } else if (input.latestRelease === null || !input.latestRelease.publishedAt) {
    add("releases", "Release cadence", null, "No GitHub releases published; many projects ship without them, so this is not scored.");
  } else {
    const days = Math.floor((now - Date.parse(input.latestRelease.publishedAt)) / DAY);
    add("releases", "Release cadence", ageScore(days, 90, 730), `Latest release ${input.latestRelease.tagName} was ${days} days ago (full score ≤ 90 days, zero at 730).`);
  }

  // Adoption: log-scaled stars and forks.
  const starPart = Math.min(1, Math.log10(repo.stars + 1) / 5);
  const forkPart = Math.min(1, Math.log10(repo.forks + 1) / 4);
  add(
    "adoption",
    "Community adoption",
    0.7 * starPart + 0.3 * forkPart,
    `${repo.stars.toLocaleString("en-US")} stars and ${repo.forks.toLocaleString("en-US")} forks, log-scaled (full score at 100k stars / 10k forks).`,
  );

  // Community files and documentation.
  if (input.community) {
    const c = input.community;
    const parts: [boolean, number, string][] = [
      [c.hasReadme, 0.3, "README"],
      [c.hasContributing, 0.2, "contributing guide"],
      [c.hasIssueTemplate, 0.15, "issue template"],
      [c.hasDescription || Boolean(repo.description), 0.15, "description"],
      [c.hasPullRequestTemplate, 0.1, "PR template"],
      [c.hasCodeOfConduct, 0.1, "code of conduct"],
    ];
    const score = parts.reduce((s, [has, w]) => s + (has ? w : 0), 0);
    const present = parts.filter(([has]) => has).map(([, , n]) => n);
    const missing = parts.filter(([has]) => !has).map(([, , n]) => n);
    add(
      "community",
      "Documentation & community files",
      score,
      `Present: ${present.join(", ") || "none"}.${missing.length ? ` Missing: ${missing.join(", ")}.` : ""}`,
    );
  } else {
    add("community", "Documentation & community files", null, "Community profile unavailable.");
  }

  // License clarity.
  if (!repo.license) {
    add("license", "License clarity", 0, "No license detected: reuse rights are unclear.");
  } else if (!repo.license.spdxId || repo.license.spdxId === "NOASSERTION") {
    add("license", "License clarity", 0.5, `License file present but not a recognised SPDX license (${repo.license.name}).`);
  } else {
    add("license", "License clarity", 1, `Recognised license: ${repo.license.spdxId}.`);
  }

  // Contributors.
  if (input.contributors) {
    const n = input.contributors.count;
    const label = input.contributors.truncated ? `${n}+` : String(n);
    add("contributors", "Contributor base", n === 0 ? 0 : Math.log10(n) / 2, `${label} contributor${n === 1 ? "" : "s"} (full score at ≥ 100).`);
  } else {
    add("contributors", "Contributor base", null, "Contributor list unavailable (GitHub does not list contributors for very large repositories).");
  }

  const total = dims.reduce((s, d) => s + d.weight, 0);
  const covered = dims.filter((d) => d.score !== null);
  const coveredWeight = covered.reduce((s, d) => s + d.weight, 0);
  const coverage = coveredWeight / total;
  const raw = coveredWeight === 0 ? 0 : covered.reduce((s, d) => s + d.weight * (d.score as number), 0) / coveredWeight;

  const status: HealthScore["status"] = coverage < 0.4 ? "insufficient" : coverage < 0.6 ? "provisional" : "ok";

  return {
    version: HEALTH_VERSION,
    score: status === "insufficient" ? null : Math.round(raw * 100),
    status,
    coverage: Math.round(coverage * 100) / 100,
    archived: repo.archived,
    dimensions: dims,
    computedAt: new Date(now).toISOString(),
  };
}
