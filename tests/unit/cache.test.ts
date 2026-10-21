import { describe, expect, it, vi } from "vitest";
import { cachedFetch } from "@/lib/cache/cached-fetch";
import { cacheKey, MemoryStore, TieredStore } from "@/lib/cache/store";
import { AppError } from "@/lib/errors";

const policy = { freshSeconds: 60, maxAgeSeconds: 3600 };

describe("cacheKey", () => {
  it("is independent of property order", () => {
    expect(cacheKey("gh", { a: 1, b: { c: 2, d: [1, 2] } })).toBe(cacheKey("gh", { b: { d: [1, 2], c: 2 }, a: 1 }));
  });

  it("changes when any part changes", () => {
    const base = { q: "react", page: 1, sort: "stars" };
    const keys = new Set([
      cacheKey("gh", base),
      cacheKey("gh", { ...base, page: 2 }),
      cacheKey("gh", { ...base, sort: "forks" }),
      cacheKey("other", base),
    ]);
    expect(keys.size).toBe(4);
  });

  it("ignores undefined values", () => {
    expect(cacheKey("gh", { a: 1, b: undefined })).toBe(cacheKey("gh", { a: 1 }));
  });
});

describe("MemoryStore", () => {
  it("evicts least recently used entries", async () => {
    const s = new MemoryStore(2);
    const rec = (v: number) => ({ value: v, etag: null, fetchedAt: 0, freshUntil: Date.now() + 1e6, expiresAt: Date.now() + 1e6 });
    await s.set("a", rec(1));
    await s.set("b", rec(2));
    await s.get("a");
    await s.set("c", rec(3));
    expect(await s.get("b")).toBeNull();
    expect((await s.get("a"))?.value).toBe(1);
  });

  it("does not return expired entries", async () => {
    const s = new MemoryStore();
    await s.set("a", { value: 1, etag: null, fetchedAt: 0, freshUntil: 0, expiresAt: Date.now() - 1 });
    expect(await s.get("a")).toBeNull();
  });
});

describe("cachedFetch", () => {
  it("fetches on miss and serves the cached copy while fresh", async () => {
    const store = new MemoryStore();
    const fetcher = vi.fn(async () => ({ kind: "data" as const, value: "v1", etag: '"e1"' }));
    const a = await cachedFetch(store, "k", policy, fetcher);
    const b = await cachedFetch(store, "k", policy, fetcher);
    expect(a.freshness.cache).toBe("miss");
    expect(b.freshness.cache).toBe("hit");
    expect(b.value).toBe("v1");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("revalidates stale entries with the stored ETag", async () => {
    const store = new MemoryStore();
    let t = Date.now();
    const now = () => t;
    await cachedFetch(store, "k", policy, async () => ({ kind: "data", value: "v1", etag: '"e1"' }), now);
    t += 120_000; // past freshSeconds
    const fetcher = vi.fn(async (etag: string | null) => {
      expect(etag).toBe('"e1"');
      return { kind: "not-modified" as const };
    });
    const r = await cachedFetch(store, "k", policy, fetcher, now);
    expect(r.freshness.cache).toBe("revalidated");
    expect(r.value).toBe("v1");
  });

  it("serves a stale copy when the upstream is rate limited", async () => {
    const store = new MemoryStore();
    let t = Date.now();
    const now = () => t;
    await cachedFetch(store, "k", policy, async () => ({ kind: "data", value: "v1", etag: null }), now);
    t += 120_000;
    const r = await cachedFetch(
      store,
      "k",
      policy,
      async () => {
        throw new AppError("UPSTREAM_RATE_LIMITED", "limited");
      },
      now,
    );
    expect(r.freshness.cache).toBe("stale-fallback");
    expect(r.value).toBe("v1");
  });

  it("does not mask non-transient errors", async () => {
    const store = new MemoryStore();
    let t = Date.now();
    const now = () => t;
    await cachedFetch(store, "k", policy, async () => ({ kind: "data", value: "v1", etag: null }), now);
    t += 120_000;
    await expect(
      cachedFetch(store, "k", policy, async () => {
        throw new AppError("NOT_FOUND", "gone");
      }, now),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deduplicates concurrent requests for the same key", async () => {
    const store = new MemoryStore();
    let resolve!: (v: { kind: "data"; value: string; etag: null }) => void;
    const fetcher = vi.fn(() => new Promise<{ kind: "data"; value: string; etag: null }>((r) => (resolve = r)));
    const p1 = cachedFetch(store, "k", policy, fetcher);
    const p2 = cachedFetch(store, "k", policy, fetcher);
    await new Promise((r) => setTimeout(r, 0));
    resolve({ kind: "data", value: "x", etag: null });
    expect((await p1).value).toBe("x");
    expect((await p2).value).toBe("x");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("TieredStore", () => {
  it("prefers a fresher L2 copy over a stale L1 copy", async () => {
    const l1 = new MemoryStore();
    const l2 = new MemoryStore();
    const far = Date.now() + 1e6;
    await l1.set("k", { value: "old", etag: null, fetchedAt: 1, freshUntil: 0, expiresAt: far });
    await l2.set("k", { value: "new", etag: null, fetchedAt: 2, freshUntil: far, expiresAt: far });
    const t = new TieredStore(l1, l2);
    expect((await t.get("k"))?.value).toBe("new");
    expect((await l1.get("k"))?.value).toBe("new");
  });
});
