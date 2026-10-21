import "server-only";
import { connection } from "next/server";
import { cache } from "react";

/**
 * One timestamp per request, shared by every server component that renders relative
 * times ("3 days ago"), so a page never mixes slightly different "now"s. Awaiting
 * connection() marks the caller as request-time rendering (Cache Components requirement).
 */
export const requestNow = cache(async (): Promise<number> => {
  await connection();
  return Date.now();
});
