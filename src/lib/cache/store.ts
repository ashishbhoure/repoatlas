import { createHash } from "node:crypto";

/** One cached value plus the metadata needed for freshness and conditional requests. */
export interface CacheRecord<T = unknown> {
  value: T;
  etag: string | null;
  /** Epoch ms when the value was fetched from the upstream source. */
  fetchedAt: number;
  /** Epoch ms after which the value is stale and should be revalidated. */
  freshUntil: number;
  /** Epoch ms after which the value must not be served at all. */
  expiresAt: number;
}

export interface CacheStore {
  get<T>(key: string): Promise<CacheRecord<T> | null>;
  set<T>(key: string, record: CacheRecord<T>): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Bounded in-process LRU. Per-instance only: never relied on for cross-instance sharing. */
export class MemoryStore implements CacheStore {
  private map = new Map<string, CacheRecord>();
  constructor(private readonly maxEntries = 500) {}

  async get<T>(key: string) {
    const rec = this.map.get(key);
    if (!rec) return null;
    if (rec.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    // refresh LRU position
    this.map.delete(key);
    this.map.set(key, rec);
    return rec as CacheRecord<T>;
  }

  async set<T>(key: string, record: CacheRecord<T>) {
    this.map.delete(key);
    this.map.set(key, record);
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  async delete(key: string) {
    this.map.delete(key);
  }

  get size() {
    return this.map.size;
  }
}

/** Reads L1 first, then L2 (populating L1). Writes go to both. */
export class TieredStore implements CacheStore {
  constructor(
    private readonly l1: CacheStore,
    private readonly l2: CacheStore,
  ) {}

  async get<T>(key: string) {
    const hit = await this.l1.get<T>(key);
    if (hit && hit.freshUntil > Date.now()) return hit;
    // L1 missing or stale: another instance may have refreshed the shared copy.
    const remote = await this.l2.get<T>(key);
    if (remote && (!hit || remote.fetchedAt > hit.fetchedAt)) {
      await this.l1.set(key, remote);
      return remote;
    }
    return hit;
  }

  async set<T>(key: string, record: CacheRecord<T>) {
    await Promise.all([this.l1.set(key, record), this.l2.set(key, record)]);
  }

  async delete(key: string) {
    await Promise.all([this.l1.delete(key), this.l2.delete(key)]);
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/**
 * Deterministic cache key: the same namespace + parts always produce the same key,
 * regardless of property order; any differing part produces a different key.
 */
export function cacheKey(namespace: string, parts: unknown): string {
  const digest = createHash("sha256").update(stableStringify(parts)).digest("hex").slice(0, 32);
  return `${namespace}:${digest}`;
}
