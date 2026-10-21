import { Archive, Star, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MarkAllRead } from "@/components/alerts/mark-read";
import { RemoveButton } from "@/components/collections/library-actions";
import { EmptyState, ListSkeleton } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { features } from "@/config/env";
import { requirePageUser } from "@/features/authentication/page-guard";
import { formatDate, formatRelative } from "@/lib/format";
import { requestNow } from "@/lib/request-time";
import { cn } from "@/lib/utils";
import { listNotifications, listWatches } from "@/server/alerts/alerts";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

const ICON = { RELEASE: Tag, STARS: Star, ARCHIVED: Archive } as const;

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Notifications"
        description="Alerts from the repositories you watch. Watched repositories are checked every few hours, not in real time."
      />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Inbox />
      </Suspense>
    </div>
  );
}

async function Inbox() {
  const guard = await requirePageUser("/notifications");
  if ("blocked" in guard) return guard.blocked;
  const [items, watches, now] = await Promise.all([listNotifications(guard.user.id), listWatches(guard.user.id), requestNow()]);
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
      <section aria-labelledby="inbox" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="inbox" className="font-semibold">
            Inbox {unread > 0 && <span className="text-sm font-normal text-muted-foreground">({unread} unread)</span>}
          </h2>
          <MarkAllRead disabled={unread === 0} />
        </div>
        {!features.cron() && (
          <p className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
            The scheduled alert check is not configured on this instance (CRON_SECRET), so no new alerts will arrive.
          </p>
        )}
        {items.length === 0 ? (
          <EmptyState title="No alerts yet">Watch a repository from its page to be told about new releases, star milestones or archiving.</EmptyState>
        ) : (
          <ul className="rounded-lg border bg-card px-4" data-testid="notifications">
            {items.map((n) => {
              const Icon = ICON[n.kind];
              return (
                <li key={n.id} className={cn("flex gap-3 border-b py-3 last:border-b-0", !n.readAt && "font-medium")}>
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {n.title}
                    </a>
                    <p className="text-sm font-normal text-muted-foreground">{n.body}</p>
                    <p className="text-xs font-normal text-muted-foreground">
                      Observed {formatRelative(n.createdAt.toISOString(), now)}
                      {!n.readAt && <span className="sr-only"> (unread)</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <aside aria-labelledby="watching" className="space-y-3">
        <h2 id="watching" className="font-semibold">
          Watching ({watches.length})
        </h2>
        {watches.length === 0 ? (
          <p className="text-sm text-muted-foreground">You are not watching any repositories.</p>
        ) : (
          <ul className="rounded-lg border bg-card px-3 text-sm">
            {watches.map((w) => (
              <li key={w.id} className="flex items-start justify-between gap-2 border-b py-2 last:border-b-0">
                <div className="min-w-0">
                  <Link href={`/repository/${w.fullName}`} className="truncate font-mono text-xs hover:underline">
                    {w.fullName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {[w.notifyRelease && "releases", w.notifyArchived && "archiving", w.starThreshold && `${w.starThreshold.toLocaleString("en-US")} stars`].filter(Boolean).join(", ")}
                    {w.lastCheckedAt ? `. Checked ${formatDate(w.lastCheckedAt.toISOString())}` : ". Not checked yet"}
                  </p>
                </div>
                <RemoveButton endpoint={`/api/watches/${w.providerRepoId}`} label={`Stop watching ${w.fullName}`} success={`Stopped watching ${w.fullName}`} />
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
