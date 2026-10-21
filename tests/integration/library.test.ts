import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

// The library resolves owner/name through the provider; fake it so no network is used.
vi.mock("@/server/providers", () => {
  const repos: Record<string, { providerId: string; fullName: string }> = {
    "acme/widget": { providerId: "1001", fullName: "acme/widget" },
    "ACME/WIDGET": { providerId: "1001", fullName: "acme/widget" },
    "acme/gadget": { providerId: "1002", fullName: "acme/gadget" },
  };
  return {
    getProvider: () => ({
      getRepository: async (owner: string, name: string) => {
        const r = repos[`${owner}/${name}`];
        if (!r) throw new AppError("NOT_FOUND", "not found");
        return { data: r, freshness: { fetchedAt: new Date().toISOString(), cache: "miss" } };
      },
    }),
  };
});

const { db } = await import("@/lib/database/prisma");
const lib = await import("@/server/collections/library");
const { recordSnapshots, getMeasuredGrowth, getSnapshotHistory } = await import("@/server/analytics/snapshots");
const { checkRateLimit } = await import("@/lib/rate-limit");
const { PostgresStore } = await import("@/lib/cache/postgres-store");

let dbUp = true;

beforeAll(async () => {
  try {
    await db().$queryRaw`SELECT 1`;
  } catch {
    dbUp = false;
  }
});

beforeEach(async (ctx) => {
  if (!dbUp) ctx.skip();
  await db().$executeRawUnsafe(
    `TRUNCATE "user", "session", "account", "verification", "SavedRepository", "Collection", "CollectionRepository", "SavedSearch", "TrackedRepository", "RepositorySnapshot", "CacheEntry", "RateLimitBucket" CASCADE`,
  );
  await db().user.createMany({
    data: [
      { id: "user_alice", name: "Alice", email: "alice@example.test" },
      { id: "user_bob", name: "Bob", email: "bob@example.test" },
    ],
  });
});

afterAll(async () => {
  if (dbUp) await db().$disconnect();
});

describe("saved repositories", () => {
  it("saves by canonical provider id, idempotently", async () => {
    await lib.saveRepository("user_alice", "acme/widget");
    await lib.saveRepository("user_alice", "ACME/WIDGET", "note");
    const items = await lib.listSavedRepositories("user_alice");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ providerRepoId: "1001", fullName: "acme/widget", note: "note" });
  });

  it("rejects repositories that do not exist", async () => {
    await expect(lib.saveRepository("user_alice", "acme/missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("scopes reads and deletes to the owner", async () => {
    await lib.saveRepository("user_alice", "acme/widget");
    expect(await lib.listSavedRepositories("user_bob")).toHaveLength(0);
    await lib.unsaveRepository("user_bob", "1001");
    expect(await lib.listSavedRepositories("user_alice")).toHaveLength(1);
    await expect(lib.updateSavedNote("user_bob", "1001", "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("handles concurrent saves of the same repository", async () => {
    await Promise.allSettled([1, 2, 3, 4].map(() => lib.saveRepository("user_alice", "acme/widget")));
    expect(await lib.listSavedRepositories("user_alice")).toHaveLength(1);
  });
});

describe("collections", () => {
  it("creates, renames and enforces unique names per user", async () => {
    const c = await lib.createCollection("user_alice", { name: "Tools" });
    await expect(lib.createCollection("user_alice", { name: "Tools" })).rejects.toMatchObject({ code: "CONFLICT" });
    await lib.createCollection("user_bob", { name: "Tools" }); // other users may reuse the name
    const renamed = await lib.updateCollection("user_alice", c.id, { name: "CLI tools", description: "d" });
    expect(renamed.name).toBe("CLI tools");
  });

  it("is private by default; sharing creates and removes a slug", async () => {
    const c = await lib.createCollection("user_alice", { name: "Shared" });
    expect(c.shareSlug).toBeNull();
    const shared = await lib.updateCollection("user_alice", c.id, { shared: true });
    expect(shared.shareSlug).toMatch(/^[A-Za-z0-9_-]{8,}$/);
    expect((await lib.getSharedCollection(shared.shareSlug!)).name).toBe("Shared");
    await lib.updateCollection("user_alice", c.id, { shared: false });
    await expect(lib.getSharedCollection(shared.shareSlug!)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("prevents duplicate items and supports notes and removal", async () => {
    const c = await lib.createCollection("user_alice", { name: "Mine" });
    await lib.addToCollection("user_alice", c.id, "acme/widget");
    await lib.addToCollection("user_alice", c.id, "ACME/WIDGET");
    await lib.addToCollection("user_alice", c.id, "acme/gadget", "second");
    let full = await lib.getOwnedCollection("user_alice", c.id);
    expect(full.items.map((i) => i.providerRepoId).sort()).toEqual(["1001", "1002"]);
    await lib.updateCollectionItemNote("user_alice", c.id, "1001", "first");
    await lib.removeFromCollection("user_alice", c.id, "1002");
    full = await lib.getOwnedCollection("user_alice", c.id);
    expect(full.items).toHaveLength(1);
    expect(full.items[0].note).toBe("first");
    const flags = await lib.collectionsForRepository("user_alice", "1001");
    expect(flags).toEqual([{ id: c.id, name: "Mine", contains: true }]);
  });

  it("does not let another user read or modify a collection", async () => {
    const c = await lib.createCollection("user_alice", { name: "Private" });
    await expect(lib.getOwnedCollection("user_bob", c.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(lib.addToCollection("user_bob", c.id, "acme/widget")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(lib.updateCollection("user_bob", c.id, { shared: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(lib.deleteCollection("user_bob", c.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await lib.listCollections("user_alice")).toHaveLength(1);
  });

  it("cascades items when a collection is deleted", async () => {
    const c = await lib.createCollection("user_alice", { name: "Gone" });
    await lib.addToCollection("user_alice", c.id, "acme/widget");
    await lib.deleteCollection("user_alice", c.id);
    expect(await db().collectionRepository.count()).toBe(0);
  });
});

describe("saved searches", () => {
  it("stores a validated spec and restores it exactly", async () => {
    const { searchSpecSchema } = await import("@/lib/validation/search");
    const spec = searchSpecSchema.parse({ q: "agents", language: ["Python"], minStars: 100, sort: "stars", page: 4 });
    await lib.createSavedSearch("user_alice", "Agents", spec);
    const [saved] = await lib.listSavedSearches("user_alice");
    expect(saved.spec).toEqual({ ...spec, page: 1 });
    await expect(lib.deleteSavedSearch("user_bob", saved.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await lib.deleteSavedSearch("user_alice", saved.id);
    expect(await lib.listSavedSearches("user_alice")).toHaveLength(0);
  });

  it("flags stored specs that no longer validate instead of running them", async () => {
    await db().savedSearch.create({ data: { userId: "user_alice", name: "Old", spec: { sort: "nonsense" } } });
    const [saved] = await lib.listSavedSearches("user_alice");
    expect(saved.spec).toBeNull();
  });
});

describe("account deletion", () => {
  it("removes all of a user's data", async () => {
    await lib.saveRepository("user_alice", "acme/widget");
    const c = await lib.createCollection("user_alice", { name: "X" });
    await lib.addToCollection("user_alice", c.id, "acme/widget");
    await db().user.delete({ where: { id: "user_alice" } });
    expect(await db().savedRepository.count()).toBe(0);
    expect(await db().collection.count()).toBe(0);
    expect(await db().collectionRepository.count()).toBe(0);
  });
});

describe("snapshots and measured growth", () => {
  const repo = (stars: number, fullName = "acme/widget") =>
    ({ provider: "github", providerId: "1001", fullName, language: "Go", stars, forks: 1, openIssues: 0 }) as never;

  it("records at most one observation per interval and tracks renames", async () => {
    const t0 = new Date(Date.now() - 2 * 86_400_000);
    expect((await recordSnapshots([repo(100)], t0, "SEARCH")).recorded).toBe(1);
    expect((await recordSnapshots([repo(101)], new Date(t0.getTime() + 3600_000), "SEARCH")).recorded).toBe(0);
    expect((await recordSnapshots([repo(150, "acme/widget-renamed")], new Date(t0.getTime() + 30 * 3600_000), "DETAILS")).recorded).toBe(1);
    const history = await getSnapshotHistory("1001");
    expect(history.map((h) => h.stars)).toEqual([100, 150]);
    expect((await db().trackedRepository.findFirstOrThrow()).fullName).toBe("acme/widget-renamed");
  });

  it("computes growth only across spans of at least 20 hours", async () => {
    const t0 = new Date(Date.now() - 3 * 86_400_000);
    await recordSnapshots([repo(100)], t0, "SEARCH");
    expect(await getMeasuredGrowth({ days: 7, limit: 10 })).toEqual([]);
    await recordSnapshots([repo(160)], new Date(t0.getTime() + 2 * 86_400_000), "CRON");
    const [g] = await getMeasuredGrowth({ days: 7, limit: 10 });
    expect(g).toMatchObject({ providerRepoId: "1001", fromStars: 100, toStars: 160, starsGained: 60 });
    expect(g.starsPerDay).toBeCloseTo(30, 5);
    expect(await getMeasuredGrowth({ days: 7, limit: 10, providerRepoIds: ["999"] })).toEqual([]);
    expect(await getMeasuredGrowth({ days: 7, limit: 10, language: "Rust" })).toEqual([]);
  });
});

describe("rate limiter and shared cache", () => {
  it("counts requests per identity within a window", async () => {
    const rule = { name: "test", limit: 2, windowSeconds: 60 };
    expect((await checkRateLimit(rule, "ip:1")).allowed).toBe(true);
    expect((await checkRateLimit(rule, "ip:1")).allowed).toBe(true);
    expect((await checkRateLimit(rule, "ip:1")).allowed).toBe(false);
    expect((await checkRateLimit(rule, "ip:2")).allowed).toBe(true);
  });

  it("stores and expires cache entries", async () => {
    const store = new PostgresStore();
    const now = Date.now();
    await store.set("k1", { value: { a: 1 }, etag: '"e"', fetchedAt: now, freshUntil: now + 1000, expiresAt: now + 60_000 });
    expect(await store.get("k1")).toMatchObject({ value: { a: 1 }, etag: '"e"' });
    await store.set("k2", { value: 1, etag: null, fetchedAt: now, freshUntil: now, expiresAt: now - 1 });
    expect(await store.get("k2")).toBeNull();
  });
});
