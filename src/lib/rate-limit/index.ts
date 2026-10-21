import "server-only";
import { db } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/observability/logger";

export interface RateLimitRule {
  /** Logical bucket name, e.g. "suggest". */
  name: string;
  limit: number;
  windowSeconds: number;
}

/**
 * Fixed-window rate limiter stored in PostgreSQL, so limits hold across serverless
 * instances. The increment is a single atomic upsert. Fails open (allows the request)
 * if the database is unavailable, logging the problem.
 */
export async function checkRateLimit(rule: RateLimitRule, identity: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const windowMs = rule.windowSeconds * 1000;
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const key = `${rule.name}:${identity}`;
  try {
    const rows = await db().$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "windowStart")
      VALUES (${key}, 1, ${windowStart})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."windowStart" < ${windowStart} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
        "windowStart" = GREATEST("RateLimitBucket"."windowStart", ${windowStart})
      RETURNING "count"
    `;
    const count = rows[0]?.count ?? 0;
    if (Math.random() < 0.01) {
      await db().rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(now - 24 * 3600 * 1000) } } });
    }
    const retryAfter = Math.ceil((windowStart.getTime() + windowMs - now) / 1000);
    return { allowed: count <= rule.limit, retryAfter };
  } catch (e) {
    log.warn("rate_limit.check_failed", { rule: rule.name, error: e });
    return { allowed: true, retryAfter: 0 };
  }
}

export async function enforceRateLimit(rule: RateLimitRule, identity: string) {
  const r = await checkRateLimit(rule, identity);
  if (!r.allowed) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please slow down and try again shortly.", {
      retryAfter: r.retryAfter,
    });
  }
}

/** Best-effort client identity for anonymous rate limiting. */
export function clientIdentity(request: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

export const RATE_LIMITS = {
  suggest: { name: "suggest", limit: 60, windowSeconds: 60 },
  search: { name: "search", limit: 30, windowSeconds: 60 },
  repository: { name: "repository", limit: 60, windowSeconds: 60 },
  mutation: { name: "mutation", limit: 60, windowSeconds: 60 },
  ai: { name: "ai", limit: 10, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;
