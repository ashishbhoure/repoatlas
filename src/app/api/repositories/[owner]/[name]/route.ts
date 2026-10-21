import { route } from "@/lib/api/handler";
import { clientIdentity, enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getSnapshotHistory } from "@/server/analytics/snapshots";
import { getRepositoryOverview } from "@/server/repositories/details";

/** GET /api/repositories/:owner/:name — metadata, health score and recorded history. */
export const GET = route(async (request: Request, ctx: RouteContext<"/api/repositories/[owner]/[name]">) => {
  await enforceRateLimit(RATE_LIMITS.repository, clientIdentity(request));
  const { owner, name } = await ctx.params;
  const o = await getRepositoryOverview(owner, name);
  const history = await getSnapshotHistory(o.repo.providerId);
  return Response.json(
    {
      repository: o.repo,
      latestRelease: o.latestRelease ?? null,
      contributors: o.contributors
        ? { count: o.contributors.contributors.length, truncated: o.contributors.truncated, top: o.contributors.contributors.slice(0, 10) }
        : null,
      community: o.community ?? null,
      languages: o.languages ?? null,
      commitActivity: o.commitActivity ?? null,
      health: o.health,
      history,
      freshness: o.freshness,
    },
    { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=600" } },
  );
});
