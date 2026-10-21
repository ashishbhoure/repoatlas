import { Bell } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { unreadCount } from "@/server/alerts/alerts";

/** Header link to the inbox with the unread count. Renders nothing when signed out. */
export async function NotificationsBell() {
  const user = await getCurrentUser();
  if (!user) return null;
  const count = await unreadCount(user.id);
  return (
    <Link
      href="/notifications"
      className="relative inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
    >
      <Bell className="size-4" aria-hidden />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[0.65rem] font-semibold leading-4 text-primary-foreground tabular">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
