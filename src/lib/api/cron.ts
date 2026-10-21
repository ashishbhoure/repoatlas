import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env, features } from "@/config/env";
import { AppError } from "@/lib/errors";

/** Scheduled jobs authenticate with `Authorization: Bearer $CRON_SECRET` (what Vercel Cron sends). */
export function assertCronRequest(request: Request) {
  if (!features.cron()) throw new AppError("FEATURE_DISABLED", "Scheduled jobs are not configured (CRON_SECRET is not set).");
  const secret = env().CRON_SECRET!;
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new AppError("UNAUTHENTICATED", "Missing or invalid cron credentials.");
  }
}
