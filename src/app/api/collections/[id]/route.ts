import { readJson, parseOrThrow, route } from "@/lib/api/handler";
import { userForMutation } from "@/lib/api/guards";
import { collectionPatchInput, idSchema } from "@/lib/validation/library";
import { deleteCollection, updateCollection } from "@/server/collections/library";

type Ctx = RouteContext<"/api/collections/[id]">;

export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const user = await userForMutation(request);
  const id = parseOrThrow(idSchema, (await ctx.params).id);
  const input = parseOrThrow(collectionPatchInput, await readJson(request));
  const c = await updateCollection(user.id, id, input);
  return Response.json({ collection: { id: c.id, name: c.name, description: c.description, shareSlug: c.shareSlug } });
});

export const DELETE = route(async (request: Request, ctx: Ctx) => {
  const user = await userForMutation(request);
  const id = parseOrThrow(idSchema, (await ctx.params).id);
  await deleteCollection(user.id, id);
  return new Response(null, { status: 204 });
});
