import { readJson, parseOrThrow, route } from "@/lib/api/handler";
import { userForMutation, userForRead } from "@/lib/api/guards";
import { collectionInput, providerRepoIdSchema } from "@/lib/validation/library";
import { collectionsForRepository, createCollection, listCollections } from "@/server/collections/library";

/** With ?repo=<providerId>, each collection reports whether it already contains that repository. */
export const GET = route(async (request: Request) => {
  const user = await userForRead();
  const repo = new URL(request.url).searchParams.get("repo");
  if (repo) {
    const providerId = parseOrThrow(providerRepoIdSchema, repo);
    return Response.json({ collections: await collectionsForRepository(user.id, providerId) });
  }
  const rows = await listCollections(user.id);
  return Response.json({
    collections: rows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      shared: Boolean(c.shareSlug),
      count: c._count.items,
      updatedAt: c.updatedAt,
    })),
  });
});

export const POST = route(async (request: Request) => {
  const user = await userForMutation(request);
  const input = parseOrThrow(collectionInput, await readJson(request));
  const c = await createCollection(user.id, input);
  return Response.json({ collection: { id: c.id, name: c.name } }, { status: 201 });
});
