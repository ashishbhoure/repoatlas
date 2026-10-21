import { readJson, parseOrThrow, route } from "@/lib/api/handler";
import { userForMutation, userForRead } from "@/lib/api/guards";
import { savedSearchInput } from "@/lib/validation/library";
import { createSavedSearch, listSavedSearches } from "@/server/collections/library";

export const GET = route(async () => {
  const user = await userForRead();
  return Response.json({ items: await listSavedSearches(user.id) });
});

export const POST = route(async (request: Request) => {
  const user = await userForMutation(request);
  const input = parseOrThrow(savedSearchInput, await readJson(request));
  const s = await createSavedSearch(user.id, input.name, input.spec);
  return Response.json({ item: { id: s.id, name: s.name } }, { status: 201 });
});
