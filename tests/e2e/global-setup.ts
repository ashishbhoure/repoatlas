import pg from "pg";
import setupDb, { TEST_DATABASE_URL } from "../setup/global-db";

/** Migrates the test database and clears all data so every run starts clean. */
export default async function globalSetup() {
  await setupDb();
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  await client.query(
    `TRUNCATE "user", "session", "account", "verification", "SavedRepository", "Collection", "CollectionRepository", "SavedSearch", "TrackedRepository", "RepositorySnapshot", "CacheEntry", "RateLimitBucket" CASCADE`,
  );
  await client.end();
}
