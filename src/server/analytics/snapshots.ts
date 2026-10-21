import "server-only";
import { Prisma, SnapshotSource } from "@/generated/prisma/client";
import { db } from "@/lib/database/prisma";
import { log } from "@/lib/observability/logger";
import type { RepositorySummary } from "@/types/repository";

/** Minimum spacing between two recorded observations of the same repository. */
export const SNAPSHOT_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Records real observations (stars/forks/issues as returned by the provider at `observedAt`)
 * for repositories, at most once per SNAPSHOT_INTERVAL. These rows are the only source for
 * measured growth; nothing is interpolated. Never throws: observation is best-effort and must
 * not break user requests.
 */
export async function recordSnapshots(
  repos: RepositorySummary[],
  observedAt: Date,
  source: keyof typeof SnapshotSource,
): Promise<{ recorded: number }> {
  const unique = [...new Map(repos.filter((r) => r.provider === "github").map((r) => [r.providerId, r])).values()];
  if (unique.length === 0) return { recorded: 0 };
  try {
    const prisma = db();
    await prisma.trackedRepository.createMany({
      data: unique.map((r) => ({
        provider: "GITHUB" as const,
        providerRepoId: r.providerId,
        fullName: r.fullName,
        fullNameLower: r.fullName.toLowerCase(),
        language: r.language,
      })),
      skipDuplicates: true,
    });
    const tracked = await prisma.trackedRepository.findMany({
      where: { provider: "GITHUB", providerRepoId: { in: unique.map((r) => r.providerId) } },
      select: { id: true, providerRepoId: true, lastSnapshotAt: true, fullName: true, language: true },
    });
    const byProviderId = new Map(unique.map((r) => [r.providerId, r]));

    const due = tracked.filter(
      (t) => !t.lastSnapshotAt || observedAt.getTime() - t.lastSnapshotAt.getTime() >= SNAPSHOT_INTERVAL_MS,
    );
    if (due.length > 0) {
      await prisma.repositorySnapshot.createMany({
        data: due.map((t) => {
          const r = byProviderId.get(t.providerRepoId)!;
          return {
            trackedRepositoryId: t.id,
            observedAt,
            stars: r.stars,
            forks: r.forks,
            openIssues: r.openIssues,
            source: SnapshotSource[source],
          };
        }),
        skipDuplicates: true,
      });
      await prisma.trackedRepository.updateMany({
        where: { id: { in: due.map((t) => t.id) } },
        data: { lastSnapshotAt: observedAt },
      });
    }

    // Keep display metadata current after renames/transfers (rare; per-row update is fine).
    const renamed = tracked.filter((t) => {
      const r = byProviderId.get(t.providerRepoId)!;
      return r.fullName !== t.fullName || r.language !== t.language;
    });
    for (const t of renamed) {
      const r = byProviderId.get(t.providerRepoId)!;
      await prisma.trackedRepository.update({
        where: { id: t.id },
        data: { fullName: r.fullName, fullNameLower: r.fullName.toLowerCase(), language: r.language },
      });
    }
    return { recorded: due.length };
  } catch (e) {
    log.warn("snapshots.record_failed", { error: e, count: unique.length });
    return { recorded: 0 };
  }
}

export interface SnapshotPoint {
  observedAt: string;
  stars: number;
  forks: number;
  openIssues: number;
}

/** All recorded observations of one repository, oldest first (bounded). */
export async function getSnapshotHistory(providerRepoId: string, limit = 500): Promise<SnapshotPoint[]> {
  try {
    const tracked = await db().trackedRepository.findUnique({
      where: { provider_providerRepoId: { provider: "GITHUB", providerRepoId } },
      select: {
        snapshots: {
          orderBy: { observedAt: "desc" },
          take: limit,
          select: { observedAt: true, stars: true, forks: true, openIssues: true },
        },
      },
    });
    return (tracked?.snapshots ?? [])
      .map((s) => ({ ...s, observedAt: s.observedAt.toISOString() }))
      .reverse();
  } catch (e) {
    log.warn("snapshots.history_failed", { error: e });
    return [];
  }
}

export interface MeasuredGrowth {
  providerRepoId: string;
  fullName: string;
  language: string | null;
  fromAt: string;
  toAt: string;
  fromStars: number;
  toStars: number;
  starsGained: number;
  forksGained: number;
  /** Stars gained per day across the measured span. */
  starsPerDay: number;
}

/** Minimum span between first and last observation before growth is reported. */
export const MIN_GROWTH_SPAN_HOURS = 20;

/**
 * Measured star growth over the last `days`, using the first and last recorded
 * observation inside the window. Only repositories with a span ≥ MIN_GROWTH_SPAN_HOURS
 * are returned.
 */
export async function getMeasuredGrowth(opts: {
  days: number;
  limit: number;
  providerRepoIds?: string[];
  language?: string;
}): Promise<MeasuredGrowth[]> {
  const ids = opts.providerRepoIds;
  if (ids && ids.length === 0) return [];
  try {
    const rows = await db().$queryRaw<
      {
        providerRepoId: string;
        fullName: string;
        language: string | null;
        first_at: Date;
        last_at: Date;
        first_stars: number;
        last_stars: number;
        first_forks: number;
        last_forks: number;
      }[]
    >`
      WITH bounds AS (
        SELECT s."trackedRepositoryId" AS id, MIN(s."observedAt") AS first_at, MAX(s."observedAt") AS last_at
        FROM "RepositorySnapshot" s
        WHERE s."observedAt" >= NOW() - (${opts.days}::int * INTERVAL '1 day')
        GROUP BY s."trackedRepositoryId"
        HAVING MAX(s."observedAt") - MIN(s."observedAt") >= (${MIN_GROWTH_SPAN_HOURS}::int * INTERVAL '1 hour')
      )
      SELECT t."providerRepoId", t."fullName", t."language",
             b.first_at, b.last_at,
             f.stars AS first_stars, l.stars AS last_stars,
             f.forks AS first_forks, l.forks AS last_forks
      FROM bounds b
      JOIN "TrackedRepository" t ON t.id = b.id
      JOIN "RepositorySnapshot" f ON f."trackedRepositoryId" = b.id AND f."observedAt" = b.first_at
      JOIN "RepositorySnapshot" l ON l."trackedRepositoryId" = b.id AND l."observedAt" = b.last_at
      WHERE 1 = 1
        ${ids ? Prisma.sql`AND t."providerRepoId" IN (${Prisma.join(ids)})` : Prisma.empty}
        ${opts.language ? Prisma.sql`AND t."language" = ${opts.language}` : Prisma.empty}
      ORDER BY (l.stars - f.stars)::float / GREATEST(EXTRACT(EPOCH FROM (b.last_at - b.first_at)), 1) DESC
      LIMIT ${opts.limit}::int
    `;
    return rows.map((r) => {
      const spanDays = (r.last_at.getTime() - r.first_at.getTime()) / 86_400_000;
      return {
        providerRepoId: r.providerRepoId,
        fullName: r.fullName,
        language: r.language,
        fromAt: r.first_at.toISOString(),
        toAt: r.last_at.toISOString(),
        fromStars: r.first_stars,
        toStars: r.last_stars,
        starsGained: r.last_stars - r.first_stars,
        forksGained: r.last_forks - r.first_forks,
        starsPerDay: spanDays > 0 ? (r.last_stars - r.first_stars) / spanDays : 0,
      };
    });
  } catch (e) {
    log.warn("snapshots.growth_failed", { error: e });
    return [];
  }
}

/** Repositories whose last observation is oldest: the cron refresh queue. */
export async function getRefreshQueue(limit: number) {
  return db().trackedRepository.findMany({
    orderBy: [{ lastSnapshotAt: { sort: "asc", nulls: "first" } }],
    take: limit,
    select: { providerRepoId: true, fullName: true, lastSnapshotAt: true },
  });
}

export async function countSnapshots() {
  try {
    const [tracked, snapshots] = await Promise.all([
      db().trackedRepository.count(),
      db().repositorySnapshot.count(),
    ]);
    return { tracked, snapshots };
  } catch {
    return { tracked: 0, snapshots: 0 };
  }
}
