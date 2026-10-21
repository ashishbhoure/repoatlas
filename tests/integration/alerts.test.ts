import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const state = { stars: 990, archived: false, release: "v1.0.0", calls: 0 };

vi.mock("@/server/providers", () => ({
  getProvider: () => ({
    getRepository: async (owner: string, name: string) => {
      state.calls++;
      if (name === "missing") throw new AppError("NOT_FOUND", "not found");
      return {
        data: { providerId: "2001", owner, name, fullName: `${owner}/${name}`, stars: state.stars, archived: state.archived, url: `https://github.com/${owner}/${name}` },
        freshness: { fetchedAt: new Date().toISOString(), cache: "miss" },
      };
    },
    getLatestRelease: async () => ({
      data: { tagName: state.release, name: null, url: "https://github.com/acme/watched/releases/latest", publishedAt: null, prerelease: false },
      freshness: { fetchedAt: new Date().toISOString(), cache: "miss" },
    }),
  }),
}));

const { db } = await import("@/lib/database/prisma");
const alerts = await import("@/server/alerts/alerts");

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
  Object.assign(state, { stars: 990, archived: false, release: "v1.0.0", calls: 0 });
  await db().$executeRawUnsafe(`TRUNCATE "user", "RepositoryWatch", "Notification" CASCADE`);
  await db().user.createMany({
    data: [
      { id: "u1", name: "One", email: "one@example.test" },
      { id: "u2", name: "Two", email: "two@example.test" },
    ],
  });
});

afterAll(async () => {
  if (dbUp) await db().$disconnect();
});

describe("alert checks", () => {
  it("records a baseline first, then raises alerts for observed changes", async () => {
    await alerts.upsertWatch("u1", "acme/watched", { notifyRelease: true, notifyArchived: true, starThreshold: 1000 });
    const t0 = new Date();
    expect(await alerts.runAlertChecks(10, t0)).toMatchObject({ checked: 1, notifications: 0 });

    Object.assign(state, { stars: 1005, release: "v1.1.0" });
    const t1 = new Date(t0.getTime() + 4 * 3600_000);
    expect(await alerts.runAlertChecks(10, t1)).toMatchObject({ checked: 1, notifications: 2 });
    const items = await alerts.listNotifications("u1");
    expect(items.map((n) => n.kind).sort()).toEqual(["RELEASE", "STARS"]);
    expect(await alerts.unreadCount("u1")).toBe(2);

    await alerts.markNotificationsRead("u1");
    expect(await alerts.unreadCount("u1")).toBe(0);
  });

  it("does not re-check a watch before the minimum interval", async () => {
    await alerts.upsertWatch("u1", "acme/watched", { notifyRelease: true, notifyArchived: true, starThreshold: null });
    const t0 = new Date();
    await alerts.runAlertChecks(10, t0);
    expect((await alerts.runAlertChecks(10, new Date(t0.getTime() + 3600_000))).due).toBe(0);
  });

  it("fetches each repository once for all of its watchers", async () => {
    await alerts.upsertWatch("u1", "acme/watched", { notifyRelease: true, notifyArchived: true, starThreshold: null });
    await alerts.upsertWatch("u2", "acme/watched", { notifyRelease: true, notifyArchived: true, starThreshold: null });
    const before = state.calls;
    expect((await alerts.runAlertChecks(10)).checked).toBe(2);
    // two calls for upsertWatch resolution happened before; the check itself fetches once
    expect(state.calls - before).toBe(1);
  });

  it("keeps watches private to their owner", async () => {
    await alerts.upsertWatch("u1", "acme/watched", { notifyRelease: true, notifyArchived: false, starThreshold: null });
    expect(await alerts.listWatches("u2")).toHaveLength(0);
    await alerts.deleteWatch("u2", "2001");
    expect(await alerts.listWatches("u1")).toHaveLength(1);
  });
});
