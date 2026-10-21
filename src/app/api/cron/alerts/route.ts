import { features } from "@/config/env";
import { assertCronRequest } from "@/lib/api/cron";
import { route } from "@/lib/api/handler";
import { log } from "@/lib/observability/logger";
import { runAlertChecks } from "@/server/alerts/alerts";

/** Scheduled alert check. Each run checks the watches that were checked longest ago. */
async function run(request: Request) {
  assertCronRequest(request);
  const result = await runAlertChecks(features.githubToken() ? 60 : 10);
  log.info("cron.alerts.done", result);
  return Response.json(result);
}

export const GET = route(run);
export const POST = route(run);
