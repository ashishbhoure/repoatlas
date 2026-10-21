import { describe, expect, it } from "vitest";
import { evaluateWatch, type WatchBaseline } from "@/server/alerts/evaluate";

const base: WatchBaseline = {
  fullName: "acme/widget",
  notifyRelease: true,
  notifyArchived: true,
  starThreshold: 1000,
  lastReleaseTag: "v1.0.0",
  lastStars: 900,
  lastArchived: false,
  lastCheckedAt: new Date("2026-10-01T00:00:00Z"),
};
const obs = { stars: 950, archived: false, url: "https://github.com/acme/widget", release: { tagName: "v1.0.0", name: null, url: "https://r" } };

describe("evaluateWatch", () => {
  it("only records a baseline on the first check", () => {
    const r = evaluateWatch({ ...base, lastCheckedAt: null, lastStars: null, lastReleaseTag: null, lastArchived: null }, { ...obs, stars: 5000, archived: true });
    expect(r.notifications).toEqual([]);
    expect(r.baseline).toEqual({ lastReleaseTag: "v1.0.0", lastStars: 5000, lastArchived: true });
  });

  it("is quiet when nothing changed", () => {
    expect(evaluateWatch(base, obs).notifications).toEqual([]);
  });

  it("detects a new release", () => {
    const r = evaluateWatch(base, { ...obs, release: { tagName: "v1.1.0", name: "Version 1.1", url: "https://rel" } });
    expect(r.notifications).toEqual([expect.objectContaining({ kind: "RELEASE", url: "https://rel", title: "acme/widget published Version 1.1" })]);
    expect(r.baseline.lastReleaseTag).toBe("v1.1.0");
  });

  it("detects archiving once", () => {
    expect(evaluateWatch(base, { ...obs, archived: true }).notifications[0].kind).toBe("ARCHIVED");
    expect(evaluateWatch({ ...base, lastArchived: true }, { ...obs, archived: true }).notifications).toEqual([]);
  });

  it("fires the star milestone only when crossing it", () => {
    expect(evaluateWatch(base, { ...obs, stars: 1003 }).notifications[0].kind).toBe("STARS");
    expect(evaluateWatch({ ...base, lastStars: 1003 }, { ...obs, stars: 1100 }).notifications).toEqual([]);
  });

  it("respects disabled alert types", () => {
    const off = { ...base, notifyRelease: false, notifyArchived: false, starThreshold: null };
    expect(evaluateWatch(off, { ...obs, stars: 5000, archived: true, release: { tagName: "v9", name: null, url: "x" } }).notifications).toEqual([]);
  });

  it("keeps the previous release tag when the repository has no releases", () => {
    expect(evaluateWatch(base, { ...obs, release: null }).baseline.lastReleaseTag).toBe("v1.0.0");
  });
});
