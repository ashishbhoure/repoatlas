import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CollectionSettings, NoteEditor, RemoveButton } from "@/components/collections/library-actions";
import { EmptyState, ListSkeleton } from "@/components/feedback/states";
import { CopyButton } from "@/components/repository/share-actions";
import { Button } from "@/components/ui/button";
import { env } from "@/config/env";
import { requirePageUser } from "@/features/authentication/page-guard";
import { compareHref } from "@/features/repository-comparison/parse";
import { isAppError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { getOwnedCollection } from "@/server/collections/library";

export const metadata: Metadata = { title: "Collection", robots: { index: false } };

export default function CollectionPage({ params }: PageProps<"/collections/[id]">) {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Suspense fallback={<ListSkeleton />}>
        <CollectionContent params={params} />
      </Suspense>
    </div>
  );
}

async function CollectionContent({ params }: Pick<PageProps<"/collections/[id]">, "params">) {
  const { id } = await params;
  const guard = await requirePageUser(`/collections/${id}`);
  if ("blocked" in guard) return guard.blocked;
  let c;
  try {
    c = await getOwnedCollection(guard.user.id, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const shareUrl = c.shareSlug ? `${env().APP_URL}/c/${c.shareSlug}` : null;

  return (
    <>
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/collections" className="hover:underline">
            Collections
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
        {c.description && <p className="max-w-2xl text-muted-foreground">{c.description}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <CollectionSettings id={c.id} name={c.name} description={c.description} shareUrl={shareUrl} />
          <Button asChild variant="outline" size="sm">
            <a href={`/api/collections/${c.id}/export?format=md`}>
              <Download /> Markdown
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/collections/${c.id}/export?format=json`}>
              <Download /> JSON
            </a>
          </Button>
        </div>
        {shareUrl && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-accent/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Anyone with this link can view:</span>
            <code className="truncate font-mono text-xs">{shareUrl}</code>
            <CopyButton value={shareUrl} label="Copy link" />
          </div>
        )}
      </header>

      {c.items.length === 0 ? (
        <EmptyState title="This collection is empty">
          Open any repository and choose “Add to collection”. <Link href="/explore" className="text-primary hover:underline">Find repositories</Link>
        </EmptyState>
      ) : (
        <>
          {c.items.length >= 2 && (
            <p className="text-sm">
              <Link href={compareHref(c.items.slice(0, 4).map((i) => i.fullName))} className="text-primary hover:underline">
                Compare {Math.min(4, c.items.length) === c.items.length ? "all" : "the first 4"}
              </Link>
            </p>
          )}
          <ul className="rounded-lg border bg-card px-4" data-testid="collection-items">
            {c.items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 border-b py-3 last:border-b-0">
                <div className="min-w-0 space-y-1">
                  <Link href={`/repository/${i.fullName}`} className="font-mono text-[0.95rem] hover:underline">
                    {i.fullName}
                  </Link>
                  <p className="text-xs text-muted-foreground">Added {formatDate(i.addedAt.toISOString())}</p>
                  <NoteEditor endpoint={`/api/collections/${c.id}/items/${i.providerRepoId}`} initial={i.note} />
                </div>
                <RemoveButton endpoint={`/api/collections/${c.id}/items/${i.providerRepoId}`} label={`Remove ${i.fullName}`} success={`Removed ${i.fullName}`} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
