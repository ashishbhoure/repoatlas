import { route } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { clientIdentity, enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { parseSearchParams } from "@/lib/validation/search";
import { searchRepositories } from "@/server/repositories/search";

/**
 * GET /api/search — same parameters as /explore. Invalid parameters are rejected here
 * (400) rather than dropped, because API callers should fix their requests.
 */
export const GET = route(async (request: Request) => {
  await enforceRateLimit(RATE_LIMITS.search, clientIdentity(request));
  const { spec, issues } = parseSearchParams(new URL(request.url).searchParams);
  if (issues.length) {
    throw new AppError("INVALID_INPUT", issues.map((i) => `${i.param}: ${i.message}`).join("; "));
  }
  const r = await searchRepositories(spec);
  return Response.json(
    {
      items: r.items,
      totalCount: r.totalCount,
      incomplete: r.incomplete,
      page: spec.page,
      perPage: spec.perPage,
      lastPage: r.lastPage,
      query: r.query,
      freshness: r.freshness,
    },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
});
