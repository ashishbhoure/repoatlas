import { z } from "zod";
import { parseOrThrow, route } from "@/lib/api/handler";
import { userForRead } from "@/lib/api/guards";
import { idSchema } from "@/lib/validation/library";
import { collectionToJson, collectionToMarkdown } from "@/features/collections/export";
import { getOwnedCollection } from "@/server/collections/library";

const format = z.enum(["md", "json"]).catch("md");

/** GET /api/collections/:id/export?format=md|json, downloaded as a file. */
export const GET = route(async (request: Request, ctx: RouteContext<"/api/collections/[id]/export">) => {
  const user = await userForRead();
  const id = parseOrThrow(idSchema, (await ctx.params).id);
  const c = await getOwnedCollection(user.id, id);
  const f = format.parse(new URL(request.url).searchParams.get("format"));
  const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "collection";
  if (f === "json") {
    return new Response(JSON.stringify(collectionToJson(c), null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.json"` },
    });
  }
  return new Response(collectionToMarkdown(c), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.md"` },
  });
});
