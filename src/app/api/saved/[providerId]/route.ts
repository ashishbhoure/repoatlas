import { readJson, parseOrThrow, route } from "@/lib/api/handler";
import { userForMutation } from "@/lib/api/guards";
import { providerRepoIdSchema, updateNoteInput } from "@/lib/validation/library";
import { unsaveRepository, updateSavedNote } from "@/server/collections/library";

type Ctx = RouteContext<"/api/saved/[providerId]">;

export const DELETE = route(async (request: Request, ctx: Ctx) => {
  const user = await userForMutation(request);
  const providerId = parseOrThrow(providerRepoIdSchema, (await ctx.params).providerId);
  await unsaveRepository(user.id, providerId);
  return new Response(null, { status: 204 });
});

export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const user = await userForMutation(request);
  const providerId = parseOrThrow(providerRepoIdSchema, (await ctx.params).providerId);
  const { note } = parseOrThrow(updateNoteInput, await readJson(request));
  await updateSavedNote(user.id, providerId, note);
  return new Response(null, { status: 204 });
});
