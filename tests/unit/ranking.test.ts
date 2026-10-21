import { describe, expect, it } from "vitest";
import { ageScore, computeHealthScore, HEALTH_WEIGHTS, type HealthInputs } from "@/server/ranking/health";
import { rankHiddenGems, scoreHiddenGem } from "@/server/ranking/hidden-gems";
import type { RepositoryDetails, RepositorySummary } from "@/types/repository";

const NOW = Date.parse("2026-10-21T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

function summary(o: Partial<RepositorySummary> = {}): RepositorySummary {
  return {
    provider: "github",
    providerId: "1",
    owner: "o",
    name: "r",
    fullName: "o/r",
    ownerAvatarUrl: null,
    ownerType: "User",
    description: "A thing",
    url: "https://github.com/o/r",
    homepage: null,
    language: "Go",
    topics: [],
    stars: 100,
    forks: 10,
    openIssues: 3,
    license: { spdxId: "MIT", name: "MIT License" },
    archived: false,
    isFork: false,
    isTemplate: false,
    defaultBranch: "main",
    sizeKb: 100,
    createdAt: daysAgo(400),
    updatedAt: daysAgo(1),
    pushedAt: daysAgo(1),
    ...o,
  };
}

function details(o: Partial<RepositoryDetails> = {}): RepositoryDetails {
  return {
    ...summary(),
    subscribers: 10,
    networkCount: 10,
    hasIssues: true,
    hasWiki: false,
    hasDiscussions: false,
    visibility: "public",
    ...o,
  };
}

const fullInputs = (o: Partial<HealthInputs> = {}): HealthInputs => ({
  repo: details({ stars: 100_000, forks: 10_000 }),
  latestRelease: { tagName: "v1", name: null, url: "https://x", publishedAt: daysAgo(10), prerelease: false },
  community: {
    healthPercentage: 100,
    hasReadme: true,
    hasLicense: true,
    hasContributing: true,
    hasCodeOfConduct: true,
    hasIssueTemplate: true,
    hasPullRequestTemplate: true,
    hasDescription: true,
  },
  contributors: { count: 100, truncated: true },
  commitActivity: Array.from({ length: 52 }, (_, i) => ({ week: String(i), commits: 20 })),
  now: NOW,
  ...o,
});

describe("ageScore", () => {
  it("is 1 within the full window, 0 past the zero point, linear between", () => {
    expect(ageScore(5, 14, 365)).toBe(1);
    expect(ageScore(400, 14, 365)).toBe(0);
    expect(ageScore(189.5, 14, 365)).toBeCloseTo(0.5, 2);
  });
});

describe("computeHealthScore", () => {
  it("weights sum to 100", () => {
    expect(Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("scores a well-maintained, well-documented project at 100", () => {
    const h = computeHealthScore(fullInputs());
    expect(h.score).toBe(100);
    expect(h.status).toBe("ok");
    expect(h.coverage).toBe(1);
    expect(h.version).toBe("health@1");
  });

  it("does not penalise projects that publish no releases", () => {
    const withRelease = computeHealthScore(fullInputs());
    const noRelease = computeHealthScore(fullInputs({ latestRelease: null }));
    expect(noRelease.dimensions.find((d) => d.key === "releases")?.score).toBeNull();
    expect(noRelease.score).toBe(withRelease.score);
    expect(noRelease.coverage).toBe(0.9);
  });

  it("zeroes maintenance and activity for archived repositories", () => {
    const h = computeHealthScore(fullInputs({ repo: details({ archived: true, stars: 100_000, forks: 10_000 }) }));
    expect(h.archived).toBe(true);
    expect(h.dimensions.find((d) => d.key === "maintenance")?.score).toBe(0);
    expect(h.dimensions.find((d) => d.key === "activity")?.score).toBe(0);
    expect(h.score).toBeLessThan(70);
  });

  it("marks low-coverage scores as provisional or insufficient instead of guessing", () => {
    const sparse = computeHealthScore({
      repo: details({ pushedAt: null }),
      latestRelease: undefined,
      community: undefined,
      contributors: undefined,
      commitActivity: undefined,
      now: NOW,
    });
    // only adoption (20) + license (10) available
    expect(sparse.coverage).toBe(0.3);
    expect(sparse.status).toBe("insufficient");
    expect(sparse.score).toBeNull();

    const partial = computeHealthScore(fullInputs({ community: undefined, contributors: undefined, commitActivity: undefined }));
    expect(partial.coverage).toBe(0.65);
    expect(partial.status).toBe("ok");
    const lower = computeHealthScore(fullInputs({ community: undefined, contributors: undefined, commitActivity: undefined, latestRelease: undefined }));
    expect(lower.status).toBe("provisional");
  });

  it("does not use raw open issue counts", () => {
    const few = computeHealthScore(fullInputs({ repo: details({ openIssues: 1, stars: 5000 }) }));
    const many = computeHealthScore(fullInputs({ repo: details({ openIssues: 5000, stars: 5000 }) }));
    expect(many.score).toBe(few.score);
  });

  it("distinguishes unrecognised licenses from missing ones", () => {
    const other = computeHealthScore(fullInputs({ repo: details({ license: { spdxId: "NOASSERTION", name: "Other" } }) }));
    const none = computeHealthScore(fullInputs({ repo: details({ license: null }) }));
    expect(other.dimensions.find((d) => d.key === "license")?.score).toBe(0.5);
    expect(none.dimensions.find((d) => d.key === "license")?.score).toBe(0);
  });
});

describe("hidden gems", () => {
  it("does not simply reward stars", () => {
    const fresh = summary({ providerId: "a", fullName: "a/fresh", stars: 40, forks: 12, pushedAt: daysAgo(1) });
    const stale = summary({ providerId: "b", fullName: "b/stale", stars: 1400, forks: 20, pushedAt: daysAgo(55) });
    const ranked = rankHiddenGems([stale, fresh], { now: NOW });
    expect(ranked[0].repo.fullName).toBe("a/fresh");
  });

  it("excludes archived, forks and out-of-band repositories", () => {
    const ranked = rankHiddenGems(
      [
        summary({ providerId: "1", archived: true }),
        summary({ providerId: "2", isFork: true }),
        summary({ providerId: "3", stars: 5 }),
        summary({ providerId: "4", stars: 50_000 }),
        summary({ providerId: "5" }),
      ],
      { now: NOW },
    );
    expect(ranked.map((r) => r.repo.providerId)).toEqual(["5"]);
  });

  it("reports momentum as unmeasured without snapshots, and uses it when measured", () => {
    const repo = summary();
    const unmeasured = scoreHiddenGem(repo, { now: NOW });
    expect(unmeasured.factors.find((f) => f.key === "momentum")?.score).toBeNull();
    const measured = scoreHiddenGem(repo, { now: NOW, starsPerDay: 14 });
    expect(measured.factors.find((f) => f.key === "momentum")?.score).toBeCloseTo(1, 1);
  });

  it("scores are bounded 0..100", () => {
    const s = scoreHiddenGem(summary({ forks: 10_000, homepage: "https://x", topics: ["a", "b", "c"] }), { now: NOW, starsPerDay: 1e6 });
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.score).toBeGreaterThanOrEqual(0);
  });
});
