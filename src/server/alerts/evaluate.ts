/**
 * Pure change detection for repository watches. Compares a fresh observation against the
 * stored baseline. The first check (no baseline yet) never notifies: alerts are only raised
 * for changes RepoAtlas actually observed between two checks.
 */
export interface WatchBaseline {
  fullName: string;
  notifyRelease: boolean;
  notifyArchived: boolean;
  starThreshold: number | null;
  lastReleaseTag: string | null;
  lastStars: number | null;
  lastArchived: boolean | null;
  lastCheckedAt: Date | null;
}

export interface Observation {
  stars: number;
  archived: boolean;
  url: string;
  release: { tagName: string; name: string | null; url: string } | null;
}

export interface PendingNotification {
  kind: "RELEASE" | "STARS" | "ARCHIVED";
  title: string;
  body: string;
  url: string;
}

export function evaluateWatch(
  w: WatchBaseline,
  o: Observation,
): { notifications: PendingNotification[]; baseline: { lastReleaseTag: string | null; lastStars: number; lastArchived: boolean } } {
  const notifications: PendingNotification[] = [];
  const firstCheck = w.lastCheckedAt === null;

  if (!firstCheck) {
    if (w.notifyRelease && o.release && o.release.tagName !== w.lastReleaseTag) {
      notifications.push({
        kind: "RELEASE",
        title: `${w.fullName} published ${o.release.name ?? o.release.tagName}`,
        body: w.lastReleaseTag ? `New release ${o.release.tagName} (previously ${w.lastReleaseTag}).` : `First release observed: ${o.release.tagName}.`,
        url: o.release.url,
      });
    }
    if (w.notifyArchived && o.archived && w.lastArchived === false) {
      notifications.push({
        kind: "ARCHIVED",
        title: `${w.fullName} was archived`,
        body: "The repository is now read-only on GitHub and is no longer maintained there.",
        url: o.url,
      });
    }
    if (w.starThreshold !== null && w.lastStars !== null && w.lastStars < w.starThreshold && o.stars >= w.starThreshold) {
      notifications.push({
        kind: "STARS",
        title: `${w.fullName} reached ${w.starThreshold.toLocaleString("en-US")} stars`,
        body: `It had ${w.lastStars.toLocaleString("en-US")} stars at the previous check and ${o.stars.toLocaleString("en-US")} now.`,
        url: o.url,
      });
    }
  }

  return {
    notifications,
    baseline: { lastReleaseTag: o.release?.tagName ?? w.lastReleaseTag, lastStars: o.stars, lastArchived: o.archived },
  };
}
