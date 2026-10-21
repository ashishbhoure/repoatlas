import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/feedback/states";
import { isAppError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { getSharedCollection } from "@/server/collections/library";

export const metadata: Metadata = { title: "Shared collection", robots: { index: false } };

const SLUG = /^[A-Za-z0-9_-]{8,32}$/;

/** Read-only view of a collection whose owner enabled link sharing. */
export default function SharedCollectionPage({ params }: PageProps<"/c/[slug]">) {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Suspense fallback={<ListSkeleton />}>
        <Shared params={params} />
      </Suspense>
    </div>
  );
}

async function Shared({ params }: Pick<PageProps<"/c/[slug]">, "params">) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  let c;
  try {
    c = await getSharedCollection(slug);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return (
    <>
      <header className="space-y-1.5">
        <p className="text-sm text-muted-foreground">Collection shared by {c.user.name} on RepoAtlas</p>
        <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
        {c.description && <p className="max-w-2xl text-muted-foreground">{c.description}</p>}
      </header>
      <ul className="rounded-lg border bg-card px-4">
        {c.items.map((i) => (
          <li key={i.id} className="space-y-1 border-b py-3 last:border-b-0">
            <Link href={`/repository/${i.fullName}`} className="font-mono text-[0.95rem] hover:underline">
              {i.fullName}
            </Link>
            {i.note && <p className="whitespace-pre-wrap text-sm text-foreground/85">{i.note}</p>}
            <p className="text-xs text-muted-foreground">Added {formatDate(i.addedAt.toISOString())}</p>
          </li>
        ))}
        {c.items.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">This collection is empty.</li>}
      </ul>
    </>
  );
}
