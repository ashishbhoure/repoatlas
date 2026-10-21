import "server-only";
import { db } from "@/lib/database/prisma";
import { AppError, isAppError } from "@/lib/errors";
import { log } from "@/lib/observability/logger";
import { resolveRepository } from "@/server/collections/library";
import { getProvider } from "@/server/providers";
import { evaluateWatch, type Observation } from "./evaluate";

export const WATCH_LIMIT = 200;
/** A watch is re-checked at most this often, however often the cron runs. */
export const MIN_CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000;

export interface WatchOptions {
  notifyRelease: boolean;
  notifyArchived: boolean;
  starThreshold: number | null;
}

export async function getWatch(userId: string, providerRepoId: string) {
  return db().repositoryWatch.findUnique({
    where: { userId_provider_providerRepoId: { userId, provider: "GITHUB", providerRepoId } },
  });
}

export async function listWatches(userId: string) {
  return db().repositoryWatch.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function upsertWatch(userId: string, fullName: string, options: WatchOptions) {
  const repo = await resolveRepository(fullName);
  const existing = await getWatch(userId, repo.providerRepoId);
  if (!existing && (await db().repositoryWatch.count({ where: { userId } })) >= WATCH_LIMIT) {
    throw new AppError("CONFLICT", `You can watch up to ${WATCH_LIMIT} repositories.`);
  }
  return db().repositoryWatch.upsert({
    where: { userId_provider_providerRepoId: { userId, provider: "GITHUB", providerRepoId: repo.providerRepoId } },
    create: { userId, provider: "GITHUB", providerRepoId: repo.providerRepoId, fullName: repo.fullName, ...options },
    update: { fullName: repo.fullName, ...options },
  });
}

export async function deleteWatch(userId: string, providerRepoId: string) {
  await db().repositoryWatch.deleteMany({ where: { userId, provider: "GITHUB", providerRepoId } });
}

export async function listNotifications(userId: string, take = 100) {
  return db().notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export async function unreadCount(userId: string) {
  return db().notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  await db().notification.updateMany({
    where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
}

/**
 * Checks the watches that were checked longest ago. One repository fetch serves every
 * watcher of that repository; provider responses are cached, so frequent runs stay cheap.
 */
export async function runAlertChecks(batch: number, now = new Date()) {
  const due = await db().repositoryWatch.findMany({
    where: { OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(now.getTime() - MIN_CHECK_INTERVAL_MS) } }] },
    orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }],
    take: batch,
  });
  const provider = getProvider("github");
  const byRepo = new Map<string, typeof due>();
  for (const w of due) byRepo.set(w.providerRepoId, [...(byRepo.get(w.providerRepoId) ?? []), w]);

  let checked = 0;
  let created = 0;
  for (const watches of byRepo.values()) {
    const [owner, name] = watches[0].fullName.split("/");
    let observation: Observation & { fullName: string };
    try {
      const { data: repo } = await provider.getRepository(owner, name);
      const { data: release } = await provider.getLatestRelease(repo.owner, repo.name);
      observation = { stars: repo.stars, archived: repo.archived, url: repo.url, release, fullName: repo.fullName };
    } catch (e) {
      if (isAppError(e) && e.code === "UPSTREAM_RATE_LIMITED") {
        log.warn("alerts.rate_limited", { checked });
        break;
      }
      log.warn("alerts.check_failed", { repo: watches[0].fullName, code: isAppError(e) ? e.code : "unknown" });
      continue;
    }
    for (const w of watches) {
      const { notifications, baseline } = evaluateWatch(w, observation);
      await db().$transaction([
        ...notifications.map((n) => db().notification.create({ data: { userId: w.userId, watchId: w.id, ...n } })),
        db().repositoryWatch.update({
          where: { id: w.id },
          data: { ...baseline, fullName: observation.fullName, lastCheckedAt: now },
        }),
      ]);
      checked++;
      created += notifications.length;
    }
  }
  return { due: due.length, checked, notifications: created };
}
