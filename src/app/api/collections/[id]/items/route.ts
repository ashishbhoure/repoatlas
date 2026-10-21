import { readJson, parseOrThrow, route } from "@/lib/api/handler";
import { userForMutation } from "@/lib/api/guards";
import { collectionItemInput, idSchema } from "@/lib/validation/library";
import { addToCollection } from "@/server/collections/library";

export const POST = route(async (request: Request, ctx: RouteContext<"/api/collections/[id]/items">) => {
  const user = await userForMutation(request);
  const id = parseOrThrow(idSchema, (await ctx.params).id);
  const input = parseOrThrow(collectionItemInput, await readJson(request));
  const item = await addToCollection(user.id, id, input.fullName, input.note ?? undefined);
  return Response.json({ item }, { status: 201 });
});
