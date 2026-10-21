import "server-only";
import { env } from "@/config/env";
import { requireUser } from "@/lib/auth/session";
import { clientIdentity, enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { assertSameOrigin } from "./handler";

/** Signed-in user for a read endpoint. */
export async function userForRead() {
  return requireUser();
}

/** Signed-in user for a mutation: same-origin check (CSRF), auth, and rate limit. */
export async function userForMutation(request: Request) {
  assertSameOrigin(request, env().APP_URL);
  const user = await requireUser();
  await enforceRateLimit(RATE_LIMITS.mutation, clientIdentity(request, user.id));
  return user;
}
