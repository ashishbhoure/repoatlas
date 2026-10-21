import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { DEFAULT_SPEC, type SearchSpec } from "@/lib/validation/search";
import { buildGitHubQuery } from "@/server/providers/github/query";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const spec = (s: Partial<SearchSpec>): SearchSpec => ({ ...DEFAULT_SPEC, ...s });

describe("buildGitHubQuery", () => {
  it("falls back to is:public when there are no criteria", () => {
    expect(buildGitHubQuery(DEFAULT_SPEC, NOW).q).toBe("is:public");
  });

  it("combines text, lists and ranges", () => {
    const b = buildGitHubQuery(
      spec({
        q: "ai agents",
        language: ["TypeScript", "Jupyter Notebook"],
        topic: ["llm", "agents"],
        license: ["mit"],
        minStars: 1000,
        maxForks: 50,
        archived: "exclude",
      }),
      NOW,
    );
    expect(b.q).toBe(
      'ai agents language:TypeScript language:"Jupyter Notebook" topic:llm topic:agents license:mit stars:>=1000 forks:<=50 archived:false',
    );
  });

  it("builds closed ranges", () => {
    expect(buildGitHubQuery(spec({ minStars: 10, maxStars: 100 }), NOW).q).toBe("stars:10..100");
  });

  it("resolves date presets relative to now", () => {
    expect(buildGitHubQuery(spec({ created: "30d" }), NOW).q).toBe("created:>=2026-09-21");
    expect(buildGitHubQuery(spec({ pushed: "24h" }), NOW).q).toBe("pushed:>=2026-10-20T12:00:00Z");
    expect(buildGitHubQuery(spec({ created: "custom", createdFrom: "2024-01-01", createdTo: "2024-06-30" }), NOW).q).toBe(
      "created:2024-01-01..2024-06-30",
    );
  });

  it("maps fork and archived tri-states", () => {
    expect(buildGitHubQuery(spec({ fork: "include" }), NOW).q).toBe("fork:true");
    expect(buildGitHubQuery(spec({ fork: "only" }), NOW).q).toBe("fork:only");
    expect(buildGitHubQuery(spec({ archived: "only" }), NOW).q).toBe("archived:true");
  });

  it("maps sort modes; best match sends no sort", () => {
    expect(buildGitHubQuery(spec({ sort: "best" }), NOW).sort).toBeUndefined();
    expect(buildGitHubQuery(spec({ sort: "updated" }), NOW).sort).toBe("updated");
  });

  it("explains every qualifier", () => {
    const b = buildGitHubQuery(spec({ q: "x", minStars: 5 }), NOW);
    expect(b.parts).toHaveLength(2);
    expect(b.parts.every((p) => p.explanation.length > 0)).toBe(true);
  });

  it("refuses queries longer than GitHub allows", () => {
    const long = spec({ q: "a".repeat(200), topic: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"] });
    expect(() => buildGitHubQuery(long, NOW)).toThrow(AppError);
  });
});
