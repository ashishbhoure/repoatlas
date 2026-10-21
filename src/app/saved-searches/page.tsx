import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RemoveButton } from "@/components/collections/library-actions";
import { EmptyState, ListSkeleton } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageUser } from "@/features/authentication/page-guard";
import { buildFilterChips } from "@/features/repository-search/chips";
import { SORT_LABELS } from "@/config/filters";
import { formatDate } from "@/lib/format";
import { specToQueryString } from "@/lib/validation/search";
import { listSavedSearches } from "@/server/collections/library";

export const metadata: Metadata = { title: "Saved searches", robots: { index: false } };

export default function SavedSearchesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Saved searches" description="Re-run a search with its exact text, filters and sort order. Results are fetched fresh each time." />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <SavedSearches />
      </Suspense>
    </div>
  );
}

async function SavedSearches() {
  const guard = await requirePageUser("/saved-searches");
  if ("blocked" in guard) return guard.blocked;
  const items = await listSavedSearches(guard.user.id);
  if (items.length === 0) {
    return (
      <EmptyState title="No saved searches">
        Run a search in <Link href="/explore" className="text-primary hover:underline">Explore</Link> and choose “Save search”.
      </EmptyState>
    );
  }
  return (
    <ul className="rounded-lg border bg-card px-4" data-testid="saved-searches">
      {items.map((s) => (
        <li key={s.id} className="flex items-start justify-between gap-3 border-b py-3 last:border-b-0">
          <div className="min-w-0 space-y-1">
            {s.spec ? (
              <Link href={`/explore${specToQueryString(s.spec)}`} className="font-medium hover:underline">
                {s.name}
              </Link>
            ) : (
              <span className="font-medium">{s.name}</span>
            )}
            {s.spec ? (
              <p className="text-xs text-muted-foreground">
                {[s.spec.q && `“${s.spec.q}”`, ...buildFilterChips(s.spec).map((c) => c.label), SORT_LABELS[s.spec.sort]].filter(Boolean).join(", ")}
              </p>
            ) : (
              <p className="text-xs text-destructive">This search uses filters that are no longer supported. Delete it and save it again.</p>
            )}
            <p className="text-xs text-muted-foreground">Saved {formatDate(s.createdAt.toISOString())}</p>
          </div>
          <RemoveButton endpoint={`/api/saved-searches/${s.id}`} label={`Delete saved search ${s.name}`} success={`Deleted ${s.name}`} />
        </li>
      ))}
    </ul>
  );
}
