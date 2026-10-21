import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPEC,
  hasCriteria,
  maxPage,
  parseSearchParams,
  specToQueryString,
  specToSearchParams,
} from "@/lib/validation/search";

describe("parseSearchParams", () => {
  it("returns defaults for empty input", () => {
    const { spec, issues } = parseSearchParams({});
    expect(spec).toEqual(DEFAULT_SPEC);
    expect(issues).toEqual([]);
    expect(spec.archived).toBe("include");
    expect(spec.fork).toBe("exclude");
  });

  it("parses comma separated and repeated list params, de-duplicating", () => {
    const { spec } = parseSearchParams(
      new URLSearchParams("language=TypeScript,Rust&language=Rust&topic=React,cli"),
    );
    expect(spec.language).toEqual(["TypeScript", "Rust"]);
    expect(spec.topic).toEqual(["react", "cli"]);
  });

  it("coerces numeric params", () => {
    const { spec } = parseSearchParams({ minStars: "1000", page: "3", perPage: "50" });
    expect(spec.minStars).toBe(1000);
    expect(spec.page).toBe(3);
    expect(spec.perPage).toBe(50);
  });

  it("drops invalid params and reports each of them instead of failing", () => {
    const { spec, issues } = parseSearchParams({
      q: "agents",
      minStars: "-5",
      sort: "random",
      language: "TypeScript,<script>",
    });
    expect(spec.q).toBe("agents");
    expect(spec.minStars).toBeUndefined();
    expect(spec.sort).toBe("best");
    expect(spec.language).toEqual(["TypeScript"]);
    expect(issues.map((i) => i.param).sort()).toEqual(["language", "minStars", "sort"]);
  });

  it("rejects inverted ranges", () => {
    const { spec, issues } = parseSearchParams({ minStars: "500", maxStars: "100" });
    expect(issues[0].param).toBe("maxStars");
    expect(spec.minStars).toBe(500);
    expect(spec.maxStars).toBeUndefined();
  });

  it("rejects pages beyond GitHub's 1,000 result window", () => {
    const { spec, issues } = parseSearchParams({ page: "60", perPage: "20" });
    expect(issues[0].param).toBe("page");
    expect(spec.page).toBe(1);
  });

  it("accepts the last reachable page", () => {
    expect(parseSearchParams({ page: "50", perPage: "20" }).issues).toEqual([]);
    expect(parseSearchParams({ page: "34", perPage: "30" }).issues).toEqual([]);
    expect(parseSearchParams({ page: "35", perPage: "30" }).issues).toHaveLength(1);
  });

  it("strips control characters and trims the query", () => {
    expect(parseSearchParams({ q: "  hello\u0007world  " }).spec.q).toBe("hello world");
  });
});

describe("specToSearchParams", () => {
  it("omits defaults", () => {
    expect(specToQueryString(DEFAULT_SPEC)).toBe("");
  });

  it("round-trips through parseSearchParams", () => {
    const input = parseSearchParams({
      q: "ai agents",
      language: "TypeScript,Python",
      topic: "llm",
      minStars: "1000",
      pushed: "30d",
      archived: "exclude",
      sort: "stars",
      page: "2",
    }).spec;
    const again = parseSearchParams(specToSearchParams(input)).spec;
    expect(again).toEqual(input);
  });
});

describe("hasCriteria / maxPage", () => {
  it("ignores pagination and sort", () => {
    expect(hasCriteria({ ...DEFAULT_SPEC, page: 4, sort: "stars" })).toBe(false);
    expect(hasCriteria({ ...DEFAULT_SPEC, language: ["Go"] })).toBe(true);
  });

  it("caps at GitHub's reachable window", () => {
    expect(maxPage(20, 5)).toBe(1);
    expect(maxPage(20, 45)).toBe(3);
    expect(maxPage(20, 2_000_000)).toBe(50);
    expect(maxPage(30, 2_000_000)).toBe(34);
  });
});
