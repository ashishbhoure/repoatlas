import { parseOrThrow, route } from "@/lib/api/handler";
import { userForMutation } from "@/lib/api/guards";
import { providerRepoIdSchema } from "@/lib/validation/library";
import { deleteWatch } from "@/server/alerts/alerts";

export const DELETE = route(async (request: Request, ctx: RouteContext<"/api/watches/[providerId]">) => {
  const user = await userForMutation(request);
  await deleteWatch(user.id, parseOrThrow(providerRepoIdSchema, (await ctx.params).providerId));
  return new Response(null, { status: 204 });
});
