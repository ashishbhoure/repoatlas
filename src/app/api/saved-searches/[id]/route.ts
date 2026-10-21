import { parseOrThrow, route } from "@/lib/api/handler";
import { userForMutation } from "@/lib/api/guards";
import { idSchema } from "@/lib/validation/library";
import { deleteSavedSearch } from "@/server/collections/library";

export const DELETE = route(async (request: Request, ctx: RouteContext<"/api/saved-searches/[id]">) => {
  const user = await userForMutation(request);
  await deleteSavedSearch(user.id, parseOrThrow(idSchema, (await ctx.params).id));
  return new Response(null, { status: 204 });
});
