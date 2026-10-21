import { createHmac, randomBytes } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import pg from "pg";
import { TEST_DATABASE_URL } from "../setup/global-db";
import { E2E_AUTH_SECRET } from "./constants";

/**
 * Signs a test user in the same way a completed GitHub OAuth flow would: a user row, a
 * session row, and Better Auth's signed session cookie (HMAC-SHA256 with AUTH_SECRET).
 * The app then validates the session through Better Auth as usual.
 */
export async function signIn(context: BrowserContext, baseURL: string, who = "e2e") {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  const userId = `user_${who}_${randomBytes(4).toString("hex")}`;
  const token = randomBytes(24).toString("base64url");
  await client.query(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, now(), now())`, [
    userId,
    `E2E ${who}`,
    `${userId}@example.test`,
  ]);
  await client.query(
    `INSERT INTO "session" (id, token, "userId", "expiresAt", "createdAt", "updatedAt") VALUES ($1, $2, $3, now() + interval '1 day', now(), now())`,
    [`sess_${userId}`, token, userId],
  );
  await client.end();
  const signature = createHmac("sha256", E2E_AUTH_SECRET).update(token).digest("base64");
  await context.addCookies([
    { name: "better-auth.session_token", value: encodeURIComponent(`${token}.${signature}`), url: baseURL, httpOnly: true, sameSite: "Lax" },
  ]);
  return userId;
}
