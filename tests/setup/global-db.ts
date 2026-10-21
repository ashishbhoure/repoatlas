import { execSync } from "node:child_process";
import pg from "pg";

/**
 * Creates (if needed) and migrates the dedicated test database before integration tests.
 * Tests never touch the development database.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://repoatlas:repoatlas@localhost:5433/repoatlas_test";

export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const admin = new URL(TEST_DATABASE_URL);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  try {
    await client.connect();
  } catch (e) {
    console.warn(`[tests] PostgreSQL unavailable at ${admin.host}; database tests will be skipped. (${(e as Error).message})`);
    process.env.REPOATLAS_DB_AVAILABLE = "0";
    return;
  }
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${dbName.replace(/"/g, "")}"`);
  await client.end();
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL }, stdio: "pipe" });
  process.env.REPOATLAS_DB_AVAILABLE = "1";
}
