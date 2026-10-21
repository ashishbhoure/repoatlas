import { z } from "zod";
import { parseOrThrow, route } from "@/lib/api/handler";
import { db } from "@/lib/database/prisma";
import { clientIdentity, enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const query = z.object({ q: z.string().trim().min(2).max(100) });

/**
 * Search-box suggestions drawn from repositories RepoAtlas has already observed.
 * Costs no GitHub API quota; it is not a complete index of GitHub.
 */
export const GET = route(async (request: Request) => {
  const { q } = parseOrThrow(query, Object.fromEntries(new URL(request.url).searchParams));
  await enforceRateLimit(RATE_LIMITS.suggest, clientIdentity(request));
  const needle = q.toLowerCase();
  const rows = await db().trackedRepository.findMany({
    where: { provider: "GITHUB", fullNameLower: { contains: needle } },
    orderBy: [{ lastSnapshotAt: { sort: "desc", nulls: "last" } }],
    take: 25,
    select: { fullName: true, language: true, snapshots: { orderBy: { observedAt: "desc" }, take: 1, select: { stars: true } } },
  });
  const ranked = rows
    .map((r) => ({
      fullName: r.fullName,
      language: r.language,
      stars: r.snapshots[0]?.stars ?? null,
      prefix: r.fullName.toLowerCase().split("/").some((part) => part.startsWith(needle)),
    }))
    .sort((a, b) => Number(b.prefix) - Number(a.prefix) || (b.stars ?? 0) - (a.stars ?? 0))
    .slice(0, 6)
    .map((r) => ({ fullName: r.fullName, language: r.language, stars: r.stars }));
  return Response.json({ suggestions: ranked }, { headers: { "Cache-Control": "private, max-age=60" } });
});
