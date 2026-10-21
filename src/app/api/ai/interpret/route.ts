import { z } from "zod";
import { env } from "@/config/env";
import { assertSameOrigin, parseOrThrow, readJson, route } from "@/lib/api/handler";
import { clientIdentity, enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { specToQueryString } from "@/lib/validation/search";
import { interpretQuery } from "@/server/ai/interpret";

const body = z.object({ query: z.string().trim().min(3, "Describe what you are looking for").max(500, "Keep the request under 500 characters") });

/**
 * POST /api/ai/interpret — turns a sentence into proposed search filters. It does not run
 * the search: the client shows the proposal for correction, then navigates to Explore.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request, env().APP_URL);
  await enforceRateLimit(RATE_LIMITS.ai, clientIdentity(request));
  const { query } = parseOrThrow(body, await readJson(request));
  const r = await interpretQuery(query);
  return Response.json({
    spec: r.spec,
    href: `/explore${specToQueryString(r.spec)}`,
    explanation: r.interpretation.explanation,
    unsupported: r.interpretation.unsupported,
    dropped: r.dropped,
  });
});
