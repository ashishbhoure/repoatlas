import { describe, expect, it } from "vitest";
import { interpretationToSpec, type Interpretation } from "@/server/ai/interpret";

const base: Interpretation = {
  keywords: [],
  languages: [],
  topics: [],
  licenses: [],
  minStars: null,
  maxStars: null,
  minForks: null,
  created: null,
  pushed: null,
  archived: "exclude",
  sort: "best",
  unsupported: [],
  explanation: "",
};

describe("interpretationToSpec", () => {
  it("maps the documented example", () => {
    const { spec, dropped } = interpretationToSpec({
      ...base,
      keywords: ["authentication"],
      languages: ["TypeScript"],
      licenses: ["mit"],
      minStars: 1000,
      pushed: "90d",
    });
    expect(dropped).toEqual([]);
    expect(spec).toMatchObject({ q: "authentication", language: ["TypeScript"], license: ["mit"], minStars: 1000, pushed: "90d", archived: "exclude" });
  });

  it("drops keywords that carry search syntax instead of executing them", () => {
    const { spec, dropped } = interpretationToSpec({ ...base, keywords: ["auth", "stars:>1", "user:evil", '"quoted"'] });
    expect(spec.q).toBe("auth");
    expect(dropped).toHaveLength(3);
  });

  it("keeps valid list values and reports invalid ones", () => {
    const { spec, dropped } = interpretationToSpec({ ...base, languages: ["Go", "<script>"], topics: ["llm", "Not A Topic!"] });
    expect(spec.language).toEqual(["Go"]);
    expect(spec.topic).toEqual(["llm"]);
    expect(dropped).toHaveLength(2);
  });

  it("rejects negative numbers", () => {
    const { spec, dropped } = interpretationToSpec({ ...base, minStars: -5 });
    expect(spec.minStars).toBeUndefined();
    expect(dropped).toHaveLength(1);
  });

  it("repairs inconsistent ranges by keeping the minimum", () => {
    const { spec, dropped } = interpretationToSpec({ ...base, minStars: 500, maxStars: 10 });
    expect(spec.minStars).toBe(500);
    expect(spec.maxStars).toBeUndefined();
    expect(dropped).toContain("an inconsistent star range");
  });
});
