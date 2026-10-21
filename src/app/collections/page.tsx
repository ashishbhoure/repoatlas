import { Link2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CreateCollectionForm } from "@/components/collections/library-actions";
import { ListSkeleton } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageUser } from "@/features/authentication/page-guard";
import { formatDate } from "@/lib/format";
import { listCollections } from "@/server/collections/library";

export const metadata: Metadata = { title: "Collections", robots: { index: false } };

export default function CollectionsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="Collections" description="Group repositories into named lists. Collections are private unless you turn on link sharing." />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Collections />
      </Suspense>
    </div>
  );
}

async function Collections() {
  const guard = await requirePageUser("/collections");
  if ("blocked" in guard) return guard.blocked;
  const rows = await listCollections(guard.user.id);
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
      <div>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No collections yet. Create one, then add repositories from any repository page.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="collection-list">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/collections/${c.id}`} className="block h-full rounded-lg border bg-card p-4 hover:border-primary/50">
                  <span className="flex items-center gap-2 font-medium">
                    {c.name}
                    {c.shareSlug && <Link2 className="size-3.5 text-muted-foreground" aria-label="Shared with a link" />}
                  </span>
                  {c.description && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{c.description}</span>}
                  <span className="mt-2 block text-xs text-muted-foreground">
                    {c._count.items} {c._count.items === 1 ? "repository" : "repositories"}, updated {formatDate(c.updatedAt.toISOString())}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <CreateCollectionForm />
    </div>
  );
}
