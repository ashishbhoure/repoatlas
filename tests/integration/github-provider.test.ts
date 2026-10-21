import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/cache/store";
import { AppError } from "@/lib/errors";
import { DEFAULT_SPEC } from "@/lib/validation/search";
import { GitHubClient, getObservedRateLimits } from "@/server/providers/github/client";
import { GitHubProvider } from "@/server/providers/github/provider";
import { ghRepo, ghSearch, rateHeaders } from "../fixtures/github";

const BASE = "https://api.github.test";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: MemoryStore;
const make = (token?: string) =>
  new GitHubProvider(
    new GitHubClient({ baseUrl: BASE, token, store, sleep: async () => {}, maxRetries: 2 }),
  );

beforeEach(() => {
  store = new MemoryStore();
});

describe("GitHubProvider.search", () => {
  it("sends the built query and normalizes results", async () => {
    let seen: URL | undefined;
    let auth: string | null = null;
    server.use(
      http.get(`${BASE}/search/repositories`, ({ request }) => {
        seen = new URL(request.url);
        auth = request.headers.get("authorization");
        return HttpResponse.json(ghSearch([ghRepo()], 1234), { headers: rateHeaders("search", 12) });
      }),
    );
    const r = await make("tkn").search({ ...DEFAULT_SPEC, q: "ui", language: ["JavaScript"], sort: "stars" });
    expect(seen?.searchParams.get("q")).toBe("ui language:JavaScript");
    expect(seen?.searchParams.get("sort")).toBe("stars");
    expect(seen?.searchParams.get("per_page")).toBe("20");
    expect(auth).toBe("Bearer tkn");
    expect(r.data.totalCount).toBe(1234);
    expect(r.data.items[0]).toMatchObject({
      providerId: "10270250",
      fullName: "facebook/react",
      stars: 240000,
      license: { spdxId: "MIT", name: "MIT License" },
      ownerType: "Organization",
    });
    expect(r.freshness.cache).toBe("miss");
    expect(getObservedRateLimits().find((l) => l.resource === "search")?.remaining).toBe(12);
  });

  it("does not send a token when none is configured", async () => {
    let auth: string | null = "unset";
    server.use(
      http.get(`${BASE}/search/repositories`, ({ request }) => {
        auth = request.headers.get("authorization");
        return HttpResponse.json(ghSearch([]));
      }),
    );
    await make().search(DEFAULT_SPEC);
    expect(auth).toBeNull();
  });

  it("serves repeated identical searches from cache", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/search/repositories`, () => {
        calls++;
        return HttpResponse.json(ghSearch([ghRepo()]));
      }),
    );
    const p = make();
    await p.search(DEFAULT_SPEC);
    const second = await p.search(DEFAULT_SPEC);
    expect(calls).toBe(1);
    expect(second.freshness.cache).toBe("hit");
  });

  it("maps primary rate limit exhaustion to UPSTREAM_RATE_LIMITED with retryAfter", async () => {
    server.use(
      http.get(`${BASE}/search/repositories`, () =>
        HttpResponse.json(
          { message: "API rate limit exceeded" },
          { status: 403, headers: { ...rateHeaders("search", 0) } },
        ),
      ),
    );
    const err = await make().search(DEFAULT_SPEC).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("UPSTREAM_RATE_LIMITED");
    expect(err.retryAfter).toBeGreaterThan(0);
    expect(err.userMessage).toMatch(/GITHUB_TOKEN/);
  });

  it("retries briefly on a short secondary rate limit (Retry-After)", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/search/repositories`, () => {
        calls++;
        if (calls === 1) return HttpResponse.json({ message: "secondary" }, { status: 429, headers: { "retry-after": "1" } });
        return HttpResponse.json(ghSearch([ghRepo()]));
      }),
    );
    const r = await make().search(DEFAULT_SPEC);
    expect(calls).toBe(2);
    expect(r.data.items).toHaveLength(1);
  });

  it("does not wait inside the request for long Retry-After values", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/search/repositories`, () => {
        calls++;
        return HttpResponse.json({ message: "secondary" }, { status: 429, headers: { "retry-after": "120" } });
      }),
    );
    const err = await make().search(DEFAULT_SPEC).catch((e) => e);
    expect(err.code).toBe("UPSTREAM_RATE_LIMITED");
    expect(err.retryAfter).toBe(120);
    expect(calls).toBe(1);
  });

  it("recognises secondary rate limits that arrive without rate-limit headers", async () => {
    server.use(
      http.get(`${BASE}/search/repositories`, () =>
        HttpResponse.json({ message: "You have exceeded a secondary rate limit. Please wait a few minutes." }, { status: 403 }),
      ),
    );
    const err = await make().search(DEFAULT_SPEC).catch((e) => e);
    expect(err.code).toBe("UPSTREAM_RATE_LIMITED");
    expect(err.retryAfter).toBe(60);
  });

  it("treats other 403s as refusals, not rate limits", async () => {
    server.use(http.get(`${BASE}/search/repositories`, () => HttpResponse.json({ message: "Resource not accessible" }, { status: 403 })));
    const err = await make().search(DEFAULT_SPEC).catch((e) => e);
    expect(err.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("maps 422 to UPSTREAM_INVALID_QUERY with GitHub's reason", async () => {
    server.use(
      http.get(`${BASE}/search/repositories`, () =>
        HttpResponse.json(
          { message: "Validation Failed", errors: [{ message: "The listed users cannot be searched" }] },
          { status: 422 },
        ),
      ),
    );
    const err = await make().search({ ...DEFAULT_SPEC, owner: "nobody" }).catch((e) => e);
    expect(err.code).toBe("UPSTREAM_INVALID_QUERY");
    expect(err.userMessage).toContain("The listed users cannot be searched");
  });

  it("retries 5xx a bounded number of times, then fails", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/search/repositories`, () => {
        calls++;
        return new HttpResponse(null, { status: 502 });
      }),
    );
    const err = await make().search(DEFAULT_SPEC).catch((e) => e);
    expect(err.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(calls).toBe(3);
  });

  it("rejects malformed payloads instead of rendering them", async () => {
    server.use(
      http.get(`${BASE}/search/repositories`, () => HttpResponse.json({ total_count: "lots", items: [{}] })),
    );
    const err = await make().search(DEFAULT_SPEC).catch((e) => e);
    expect(err.code).toBe("UPSTREAM_BAD_RESPONSE");
  });
});

describe("GitHubProvider repository endpoints", () => {
  it("throws NOT_FOUND for a missing repository", async () => {
    server.use(http.get(`${BASE}/repos/nope/missing`, () => HttpResponse.json({ message: "Not Found" }, { status: 404 })));
    const err = await make().getRepository("nope", "missing").catch((e) => e);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("rejects path traversal in owner/name before any request", async () => {
    await expect(make().getRepository("..", "x")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(make().getRepository("a/b", "x")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("returns null for a repository without releases", async () => {
    server.use(
      http.get(`${BASE}/repos/facebook/react/releases/latest`, () => HttpResponse.json({ message: "Not Found" }, { status: 404 })),
    );
    expect((await make().getLatestRelease("facebook", "react")).data).toBeNull();
  });

  it("returns null while GitHub computes commit statistics (202)", async () => {
    server.use(
      http.get(`${BASE}/repos/facebook/react/stats/commit_activity`, () => HttpResponse.json({}, { status: 202 })),
    );
    expect((await make().getCommitActivity("facebook", "react")).data).toBeNull();
  });

  it("marks contributor lists as truncated when a full page is returned", async () => {
    const page = Array.from({ length: 100 }, (_, i) => ({
      login: `u${i}`,
      avatar_url: null,
      html_url: null,
      contributions: 100 - i,
      type: "User",
    }));
    server.use(http.get(`${BASE}/repos/facebook/react/contributors`, () => HttpResponse.json(page)));
    const r = await make().getContributors("facebook", "react");
    expect(r.data?.truncated).toBe(true);
    expect(r.data?.contributors).toHaveLength(100);
  });

  it("requests rendered README HTML", async () => {
    let accept: string | null = null;
    server.use(
      http.get(`${BASE}/repos/facebook/react/readme`, ({ request }) => {
        accept = request.headers.get("accept");
        return new HttpResponse("<h1>React</h1>", { headers: { "content-type": "text/html" } });
      }),
    );
    const r = await make().getReadmeHtml("facebook", "react");
    expect(accept).toBe("application/vnd.github.html");
    expect(r.data).toBe("<h1>React</h1>");
  });

  it("revalidates with If-None-Match and accepts 304", async () => {
    let t = Date.now();
    const client = new GitHubClient({ baseUrl: BASE, store, sleep: async () => {}, now: () => t });
    const p = new GitHubProvider(client);
    let ifNoneMatch: string | null = null;
    let calls = 0;
    server.use(
      http.get(`${BASE}/repos/facebook/react`, ({ request }) => {
        calls++;
        ifNoneMatch = request.headers.get("if-none-match");
        if (ifNoneMatch === '"abc"') return new HttpResponse(null, { status: 304 });
        return HttpResponse.json(ghRepo(), { headers: { etag: '"abc"' } });
      }),
    );
    await p.getRepository("facebook", "react");
    t += 31 * 60 * 1000;
    const r = await p.getRepository("facebook", "react");
    expect(calls).toBe(2);
    expect(ifNoneMatch).toBe('"abc"');
    expect(r.freshness.cache).toBe("revalidated");
    expect(r.data.fullName).toBe("facebook/react");
  });
});
