import { redirect } from "next/navigation";
import { features } from "@/config/env";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { EmptyState } from "@/components/feedback/states";

/** For signed-in pages: the user, or a redirect to sign-in (or a notice when auth is disabled). */
export async function requirePageUser(path: string): Promise<{ user: SessionUser } | { blocked: React.ReactNode }> {
  if (!features.auth()) {
    return {
      blocked: (
        <EmptyState title="Accounts are not enabled on this RepoAtlas instance">
          Saved repositories, collections and saved searches need GitHub sign-in to be configured. See the setup guide
          in the project README.
        </EmptyState>
      ),
    };
  }
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(path)}`);
  return { user };
}
