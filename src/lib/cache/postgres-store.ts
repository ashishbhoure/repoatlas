import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database/prisma";
import { log } from "@/lib/observability/logger";
import type { CacheRecord, CacheStore } from "./store";

/**
 * Durable cache shared by all app instances. Fails open: a database problem degrades
 * to "cache miss" rather than breaking the request.
 */
export class PostgresStore implements CacheStore {
  async get<T>(key: string): Promise<CacheRecord<T> | null> {
    try {
      const row = await db().cacheEntry.findUnique({ where: { key } });
      if (!row || row.expiresAt.getTime() <= Date.now()) return null;
      return {
        value: row.value as T,
        etag: row.etag,
        fetchedAt: row.fetchedAt.getTime(),
        freshUntil: row.freshUntil.getTime(),
        expiresAt: row.expiresAt.getTime(),
      };
    } catch (e) {
      log.warn("cache.pg.get_failed", { key, error: e });
      return null;
    }
  }

  async set<T>(key: string, record: CacheRecord<T>): Promise<void> {
    const data = {
      value: record.value as Prisma.InputJsonValue,
      etag: record.etag,
      fetchedAt: new Date(record.fetchedAt),
      freshUntil: new Date(record.freshUntil),
      expiresAt: new Date(record.expiresAt),
    };
    try {
      await db().cacheEntry.upsert({ where: { key }, create: { key, ...data }, update: data });
      // Opportunistic cleanup keeps the table bounded without a separate job.
      if (Math.random() < 0.02) {
        await db().cacheEntry.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      }
    } catch (e) {
      log.warn("cache.pg.set_failed", { key, error: e });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await db().cacheEntry.deleteMany({ where: { key } });
    } catch (e) {
      log.warn("cache.pg.delete_failed", { key, error: e });
    }
  }
}
