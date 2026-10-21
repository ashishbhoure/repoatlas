import { features } from "@/config/env";
import { assertCronRequest } from "@/lib/api/cron";
import { route } from "@/lib/api/handler";
import { isAppError } from "@/lib/errors";
import { log } from "@/lib/observability/logger";
import { getRefreshQueue, recordSnapshots } from "@/server/analytics/snapshots";
import { getProvider } from "@/server/providers";

/** Repositories refreshed per run; bounded so one run cannot exhaust the API quota. */
const BATCH_WITH_TOKEN = 50;
const BATCH_ANONYMOUS = 10;

/**
 * Scheduled refresh: re-fetches the tracked repositories observed longest ago and records a
 * snapshot for each. Invoke with `Authorization: Bearer $CRON_SECRET` (e.g. Vercel Cron).
 */
async function run(request: Request) {
  assertCronRequest(request);
  const batch = features.githubToken() ? BATCH_WITH_TOKEN : BATCH_ANONYMOUS;
  const queue = await getRefreshQueue(batch);
  const provider = getProvider("github");
  let recorded = 0;
  let failed = 0;
  for (const item of queue) {
    const [owner, name] = item.fullName.split("/");
    try {
      const { data, freshness } = await provider.getRepository(owner, name);
      recorded += (await recordSnapshots([data], new Date(freshness.fetchedAt), "CRON")).recorded;
    } catch (e) {
      failed++;
      if (isAppError(e) && e.code === "UPSTREAM_RATE_LIMITED") {
        log.warn("cron.snapshots.rate_limited", { recorded, failed });
        break;
      }
    }
  }
  log.info("cron.snapshots.done", { candidates: queue.length, recorded, failed });
  return Response.json({ candidates: queue.length, recorded, failed });
}

export const GET = route(run);
export const POST = route(run);
