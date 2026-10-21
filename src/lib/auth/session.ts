import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { AppError } from "@/lib/errors";
import { getAuth } from "./auth";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

/** Current user, or null when signed out or auth is not configured. Reads request headers. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const auth = getAuth();
  if (!auth) return null;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user;
  return { id: u.id, name: u.name, email: u.email, image: u.image ?? null };
});

/** For protected server operations: returns the user or throws UNAUTHENTICATED/FEATURE_DISABLED. */
export async function requireUser(): Promise<SessionUser> {
  if (!getAuth()) {
    throw new AppError("FEATURE_DISABLED", "Accounts are not enabled on this RepoAtlas instance.");
  }
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Sign in to use this feature.");
  return user;
}
