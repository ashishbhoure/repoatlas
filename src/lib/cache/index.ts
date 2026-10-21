import "server-only";
import { PostgresStore } from "./postgres-store";
import { MemoryStore, TieredStore, type CacheStore } from "./store";

export { cacheKey } from "./store";
export { cachedFetch, type CachePolicy, type DataFreshness } from "./cached-fetch";

const globalForCache = globalThis as unknown as { repoAtlasCache?: CacheStore };

/** Process-wide cache: in-memory L1 in front of the shared PostgreSQL L2. */
export function appCache(): CacheStore {
  if (!globalForCache.repoAtlasCache) {
    globalForCache.repoAtlasCache = new TieredStore(new MemoryStore(500), new PostgresStore());
  }
  return globalForCache.repoAtlasCache;
}
