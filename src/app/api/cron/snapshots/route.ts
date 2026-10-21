import { timingSafeEqual } from "node:crypto";
import { env, features } from "@/config/env";
import { route } from "@/lib/api/handler";
import { AppError, isAppError } from "@/lib/errors";
import { log } from "@/lib/observability/logger";
import { getRefreshQueue, recordSnapshots } from "@/server/analytics/snapshots";
import { getProvider } from "@/server/providers";

/** Repositories refreshed per run; bounded so one run cannot exhaust the API quota. */
const BATCH_WITH_TOKEN = 50;
const BATCH_ANONYMOUS = 10;

function authorized(request: Request) {
  const secret = env().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Scheduled refresh: re-fetches the tracked repositories observed longest ago and records a
 * snapshot for each. Invoke with `Authorization: Bearer $CRON_SECRET` (e.g. Vercel Cron).
 */
async function run(request: Request) {
  if (!features.cron()) throw new AppError("FEATURE_DISABLED", "Scheduled refresh is not configured (CRON_SECRET is not set).");
  if (!authorized(request)) throw new AppError("UNAUTHENTICATED", "Missing or invalid cron credentials.");

  const batch = features.githubToken() ? BATCH_WITH_TOKEN : BATCH_ANONYMOUS;
  const queue = await getRefreshQueue(batch);
  const provider = getProvider("github");
  let refreshed = 0;
  let failed = 0;
  for (const item of queue) {
    const [owner, name] = item.fullName.split("/");
    try {
      const { data, freshness } = await provider.getRepository(owner, name);
      const r = await recordSnapshots([data], new Date(freshness.fetchedAt), "CRON");
      refreshed += r.recorded;
    } catch (e) {
      failed++;
      if (isAppError(e) && e.code === "UPSTREAM_RATE_LIMITED") {
        log.warn("cron.snapshots.rate_limited", { refreshed, remaining: queue.length - refreshed - failed });
        break;
      }
    }
  }
  log.info("cron.snapshots.done", { candidates: queue.length, refreshed, failed });
  return Response.json({ candidates: queue.length, recorded: refreshed, failed });
}

export const GET = route(run);
export const POST = route(run);
