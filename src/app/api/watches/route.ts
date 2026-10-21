import { z } from "zod";
import { readJson, parseOrThrow, route } from "@/lib/api/handler";
import { userForMutation, userForRead } from "@/lib/api/guards";
import { providerRepoIdSchema } from "@/lib/validation/library";
import { getWatch, listWatches, upsertWatch } from "@/server/alerts/alerts";

const watchInput = z.object({
  fullName: z.string().regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/, "Use the form owner/name"),
  notifyRelease: z.boolean(),
  notifyArchived: z.boolean(),
  starThreshold: z.number().int().min(1).max(10_000_000).nullable(),
});

/** GET /api/watches[?repo=<providerId>] */
export const GET = route(async (request: Request) => {
  const user = await userForRead();
  const repo = new URL(request.url).searchParams.get("repo");
  if (repo) return Response.json({ watch: await getWatch(user.id, parseOrThrow(providerRepoIdSchema, repo)) });
  return Response.json({ watches: await listWatches(user.id) });
});

/** PUT /api/watches — create or update the watch for a repository. */
export const PUT = route(async (request: Request) => {
  const user = await userForMutation(request);
  const input = parseOrThrow(watchInput, await readJson(request));
  const { fullName, ...options } = input;
  if (!options.notifyRelease && !options.notifyArchived && options.starThreshold === null) {
    return Response.json({ error: { code: "INVALID_INPUT", message: "Choose at least one thing to be alerted about." } }, { status: 400 });
  }
  const watch = await upsertWatch(user.id, fullName, options);
  return Response.json({ watch });
});
