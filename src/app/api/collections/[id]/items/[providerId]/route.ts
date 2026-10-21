import { readJson, parseOrThrow, route } from "@/lib/api/handler";
import { userForMutation } from "@/lib/api/guards";
import { idSchema, providerRepoIdSchema, updateNoteInput } from "@/lib/validation/library";
import { removeFromCollection, updateCollectionItemNote } from "@/server/collections/library";

type Ctx = RouteContext<"/api/collections/[id]/items/[providerId]">;

export const DELETE = route(async (request: Request, ctx: Ctx) => {
  const user = await userForMutation(request);
  const p = await ctx.params;
  await removeFromCollection(user.id, parseOrThrow(idSchema, p.id), parseOrThrow(providerRepoIdSchema, p.providerId));
  return new Response(null, { status: 204 });
});

export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const user = await userForMutation(request);
  const p = await ctx.params;
  const { note } = parseOrThrow(updateNoteInput, await readJson(request));
  await updateCollectionItemNote(user.id, parseOrThrow(idSchema, p.id), parseOrThrow(providerRepoIdSchema, p.providerId), note);
  return new Response(null, { status: 204 });
});
