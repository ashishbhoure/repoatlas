import { z } from "zod";
import { readJson, parseOrThrow, route } from "@/lib/api/handler";
import { userForMutation, userForRead } from "@/lib/api/guards";
import { listNotifications, markNotificationsRead, unreadCount } from "@/server/alerts/alerts";

export const GET = route(async () => {
  const user = await userForRead();
  const [items, unread] = await Promise.all([listNotifications(user.id), unreadCount(user.id)]);
  return Response.json({ items, unread });
});

const readInput = z.object({ ids: z.array(z.string().max(40)).max(200).optional() });

/** POST /api/notifications — mark given (or all) notifications as read. */
export const POST = route(async (request: Request) => {
  const user = await userForMutation(request);
  const { ids } = parseOrThrow(readInput, await readJson(request));
  await markNotificationsRead(user.id, ids);
  return new Response(null, { status: 204 });
});
