import { AppError } from "@/lib/errors";
import type { CacheRecord, CacheStore } from "./store";

export type CacheStatus = "hit" | "miss" | "revalidated" | "stale-fallback";

/** Freshness information surfaced to the UI ("Fetched 4 min ago · cached"). */
export interface DataFreshness {
  fetchedAt: string;
  cache: CacheStatus;
}

export interface CachePolicy {
  /** Seconds a value is served without contacting the upstream. */
  freshSeconds: number;
  /** Seconds after fetch during which a stale value may still be served if the upstream fails. */
  maxAgeSeconds: number;
}

export type FetchOutcome<T> =
  | { kind: "data"; value: T; etag: string | null }
  | { kind: "not-modified" };

/** Upstream failures where serving a stale copy is better than an error page. */
const FALLBACK_CODES = new Set(["UPSTREAM_RATE_LIMITED", "UPSTREAM_UNAVAILABLE"]);

const inflight = new Map<string, Promise<{ value: unknown; freshness: DataFreshness }>>();

/**
 * Stale-while-revalidate read-through cache with ETag revalidation:
 * - fresh entry → served directly ("hit")
 * - stale entry → conditional request with If-None-Match; 304 extends it ("revalidated")
 * - upstream rate-limited/unavailable and an unexpired entry exists → served ("stale-fallback")
 * Concurrent identical requests within one instance share a single upstream call.
 */
export async function cachedFetch<T>(
  store: CacheStore,
  key: string,
  policy: CachePolicy,
  fetcher: (etag: string | null) => Promise<FetchOutcome<T>>,
  now: () => number = Date.now,
): Promise<{ value: T; freshness: DataFreshness }> {
  const existing = await store.get<T>(key);
  if (existing && existing.freshUntil > now()) {
    return { value: existing.value, freshness: freshnessOf(existing, "hit") };
  }

  const pending = inflight.get(key);
  if (pending) return pending as Promise<{ value: T; freshness: DataFreshness }>;

  const run = (async () => {
    try {
      const outcome = await fetcher(existing?.etag ?? null);
      const t = now();
      if (outcome.kind === "not-modified") {
        if (!existing) {
          throw new AppError("UPSTREAM_BAD_RESPONSE", "The data source returned an unexpected response.");
        }
        const refreshed: CacheRecord<T> = {
          ...existing,
          fetchedAt: t,
          freshUntil: t + policy.freshSeconds * 1000,
          expiresAt: t + policy.maxAgeSeconds * 1000,
        };
        await store.set(key, refreshed);
        return { value: refreshed.value, freshness: freshnessOf(refreshed, "revalidated") };
      }
      const record: CacheRecord<T> = {
        value: outcome.value,
        etag: outcome.etag,
        fetchedAt: t,
        freshUntil: t + policy.freshSeconds * 1000,
        expiresAt: t + policy.maxAgeSeconds * 1000,
      };
      await store.set(key, record);
      return { value: record.value, freshness: freshnessOf(record, "miss") };
    } catch (e) {
      if (existing && e instanceof AppError && FALLBACK_CODES.has(e.code)) {
        return { value: existing.value, freshness: freshnessOf(existing, "stale-fallback") };
      }
      throw e;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, run);
  return run;
}

function freshnessOf(rec: CacheRecord, cache: CacheStatus): DataFreshness {
  return { fetchedAt: new Date(rec.fetchedAt).toISOString(), cache };
}
