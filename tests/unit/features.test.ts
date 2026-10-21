import { describe, expect, it } from "vitest";
import { buildFilterChips, clearFilters } from "@/features/repository-search/chips";
import { collectionToJson, collectionToMarkdown } from "@/features/collections/export";
import { compareHref, MAX_COMPARE, parseCompareParam } from "@/features/repository-comparison/parse";
import { pageWindow } from "@/components/search/pagination";
import { safeNextPath } from "@/lib/auth/redirect";
import { formatBytesFromKb, formatCount, formatDate, formatRelative } from "@/lib/format";
import { DEFAULT_SPEC, specToQueryString } from "@/lib/validation/search";
import { tally } from "@/server/analytics/aggregates";
import { resolveDiscoverySpec } from "@/features/repository-search/discovery-page";
import type { RepositorySummary } from "@/types/repository";

describe("filter chips", () => {
  const spec = { ...DEFAULT_SPEC, language: ["Go", "Rust"], topic: ["cli"], minStars: 100, maxStars: 500, archived: "exclude" as const, page: 3 };

  it("creates one removable chip per active filter", () => {
    const chips = buildFilterChips(spec);
    expect(chips.map((c) => c.label)).toEqual(["Go", "Rust", "Topic: cli", "100–500 stars", "Archived excluded"]);
  });

  it("removes exactly one value and resets the page", () => {
    const go = buildFilterChips(spec).find((c) => c.key === "language:Go")!;
    expect(go.without.language).toEqual(["Rust"]);
    expect(go.without.page).toBe(1);
    expect(go.without.topic).toEqual(["cli"]);
  });

  it("does not offer locked keys for removal", () => {
    expect(buildFilterChips(spec, ["language"]).some((c) => c.key.startsWith("language"))).toBe(false);
  });

  it("clear keeps text, sort and locked keys", () => {
    const c = clearFilters({ ...spec, q: "x", sort: "stars" }, ["minStars"]);
    expect(c.q).toBe("x");
    expect(c.sort).toBe("stars");
    expect(c.minStars).toBe(100);
    expect(c.language).toEqual([]);
  });
});

describe("discovery views", () => {
  it("applies view defaults when the URL has no params", () => {
    const { spec } = resolveDiscoverySpec("recently-created", {});
    expect(spec.created).toBe("30d");
    expect(spec.sort).toBe("stars");
  });

  it("never lets the URL override locked keys", () => {
    const { spec } = resolveDiscoverySpec("most-forked", { sort: "stars", language: "Go" });
    expect(spec.sort).toBe("forks");
    expect(spec.language).toEqual(["Go"]);
  });
});

describe("compare param", () => {
  it("parses, dedupes case-insensitively and caps the count", () => {
    const r = parseCompareParam("a/b,A/B,c/d,e/f,g/h,i/j");
    expect(r.repos).toEqual(["a/b", "c/d", "e/f", "g/h"]);
    expect(r.repos).toHaveLength(MAX_COMPARE);
    expect(r.issues).toHaveLength(1);
  });

  it("reports invalid entries", () => {
    const r = parseCompareParam(["ok/repo", "../etc", "nope", "a/.."]);
    expect(r.repos).toEqual(["ok/repo"]);
    expect(r.issues).toHaveLength(3);
  });

  it("builds shareable links", () => {
    expect(compareHref(["a/b", "c/d"])).toBe("/compare?repos=a/b,c/d");
    expect(compareHref([])).toBe("/compare");
  });
});

describe("safeNextPath (open redirect protection)", () => {
  it.each([
    ["/collections", "/collections"],
    ["/explore?q=x#y", "/explore?q=x#y"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
    ["", "/"],
    [undefined, "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input as string | undefined)).toBe(expected);
  });
});

describe("pagination window", () => {
  it("shows first, last and neighbours with gaps", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 5)).toEqual([1, 2, "gap", 5]);
    expect(pageWindow(10, 50)).toEqual([1, "gap", 9, 10, 11, "gap", 50]);
    expect(pageWindow(50, 50)).toEqual([1, "gap", 49, 50]);
  });
});

describe("format", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  it("formats counts compactly", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1234)).toBe("1.2K");
    expect(formatCount(2_500_000)).toBe("2.5M");
  });
  it("formats relative times", () => {
    expect(formatRelative("2026-10-21T11:59:30Z", now)).toBe("just now");
    expect(formatRelative("2026-10-18T12:00:00Z", now)).toBe("3 days ago");
    expect(formatRelative(null, now)).toBe("unknown");
  });
  it("formats dates in UTC and sizes", () => {
    expect(formatDate("2026-01-02T23:30:00Z")).toBe("Jan 2, 2026");
    expect(formatBytesFromKb(512)).toBe("512 KB");
    expect(formatBytesFromKb(2048)).toBe("2.0 MB");
  });
});

describe("collection export", () => {
  const c = {
    name: "Auth *libs*",
    description: null,
    items: [{ fullName: "a/b", note: "great\nlib", addedAt: new Date("2026-01-01T00:00:00Z") }],
  };
  it("escapes markdown and links repositories", () => {
    const md = collectionToMarkdown(c);
    expect(md).toContain("# Auth \\*libs\\*");
    expect(md).toContain("- [a/b](https://github.com/a/b): great lib");
  });
  it("exports JSON with URLs and dates", () => {
    expect(collectionToJson(c).repositories[0]).toEqual({ fullName: "a/b", url: "https://github.com/a/b", note: "great\nlib", addedAt: "2026-01-01T00:00:00.000Z" });
  });
});

describe("tally", () => {
  const r = (language: string | null, topics: string[]) => ({ language, topics }) as unknown as RepositorySummary;
  it("counts a sample and reports shares", () => {
    const t = tally([r("Go", ["a", "b"]), r("Go", ["a"]), r(null, ["a"]), r("Rust", [])], (x) => x.language);
    expect(t).toEqual([
      { name: "Go", count: 2, share: 0.5 },
      { name: "Rust", count: 1, share: 0.25 },
    ]);
    expect(tally([r("Go", ["a", "a"])], (x) => x.topics)[0].count).toBe(1);
  });
});

describe("spec URL for saved searches", () => {
  it("is stable for the same spec", () => {
    expect(specToQueryString({ ...DEFAULT_SPEC, language: ["Go"], sort: "stars" })).toBe("?language=Go&sort=stars");
  });
});
