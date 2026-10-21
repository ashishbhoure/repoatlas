import { readJson, parseOrThrow, route } from "@/lib/api/handler";
import { userForMutation, userForRead } from "@/lib/api/guards";
import { saveRepositoryInput } from "@/lib/validation/library";
import { listSavedRepositories, saveRepository } from "@/server/collections/library";

export const GET = route(async () => {
  const user = await userForRead();
  const items = await listSavedRepositories(user.id);
  return Response.json({ items });
});

export const POST = route(async (request: Request) => {
  const user = await userForMutation(request);
  const input = parseOrThrow(saveRepositoryInput, await readJson(request));
  const saved = await saveRepository(user.id, input.fullName, input.note ?? undefined);
  return Response.json({ item: saved }, { status: 201 });
});
