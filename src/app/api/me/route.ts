import { route } from "@/lib/api/handler";
import { userForMutation, userForRead } from "@/lib/api/guards";
import { db } from "@/lib/database/prisma";

/** GET /api/me — everything RepoAtlas stores about the signed-in user (data export). */
export const GET = route(async () => {
  const user = await userForRead();
  const data = await db().user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      createdAt: true,
      savedRepositories: { select: { fullName: true, note: true, createdAt: true } },
      collections: {
        select: { name: true, description: true, shareSlug: true, createdAt: true, items: { select: { fullName: true, note: true, addedAt: true } } },
      },
      savedSearches: { select: { name: true, spec: true, createdAt: true } },
    },
  });
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="repoatlas-export.json"' },
  });
});

/** DELETE /api/me — deletes the account and all of its data (cascades), and its sessions. */
export const DELETE = route(async (request: Request) => {
  const user = await userForMutation(request);
  await db().user.delete({ where: { id: user.id } });
  return new Response(null, { status: 204 });
});
