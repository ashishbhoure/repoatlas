import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NoteEditor, RemoveButton } from "@/components/collections/library-actions";
import { EmptyState, ListSkeleton } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageUser } from "@/features/authentication/page-guard";
import { compareHref } from "@/features/repository-comparison/parse";
import { formatDate } from "@/lib/format";
import { listSavedRepositories } from "@/server/collections/library";

export const metadata: Metadata = { title: "Saved repositories", robots: { index: false } };

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Saved repositories" description="Repositories you bookmarked. Only you can see this list." />
      <Suspense fallback={<ListSkeleton />}>
        <SavedList />
      </Suspense>
    </div>
  );
}

async function SavedList() {
  const guard = await requirePageUser("/saved");
  if ("blocked" in guard) return guard.blocked;
  const items = await listSavedRepositories(guard.user.id);
  if (items.length === 0) {
    return (
      <EmptyState title="Nothing saved yet">
        Use the Save button on any repository to keep it here. <Link href="/explore" className="text-primary hover:underline">Find repositories</Link>
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {items.length} saved.{" "}
        {items.length >= 2 && (
          <Link href={compareHref(items.slice(0, 4).map((i) => i.fullName))} className="text-primary hover:underline">
            Compare the {Math.min(4, items.length)} most recent
          </Link>
        )}
      </p>
      <ul className="rounded-lg border bg-card px-4" data-testid="saved-list">
        {items.map((i) => (
          <li key={i.id} className="flex items-start justify-between gap-3 border-b py-3 last:border-b-0">
            <div className="min-w-0 space-y-1">
              <Link href={`/repository/${i.fullName}`} className="font-mono text-[0.95rem] hover:underline">
                {i.fullName}
              </Link>
              <p className="text-xs text-muted-foreground">Saved {formatDate(i.createdAt.toISOString())}</p>
              <NoteEditor endpoint={`/api/saved/${i.providerRepoId}`} initial={i.note} />
            </div>
            <RemoveButton endpoint={`/api/saved/${i.providerRepoId}`} label={`Unsave ${i.fullName}`} success={`Removed ${i.fullName}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
