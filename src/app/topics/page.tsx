import type { Metadata } from "next";
import Link from "next/link";
import { MethodNote, PageHeader } from "@/components/layout/page-header";
import { TOPIC_CATEGORIES } from "@/config/topics";

export const metadata: Metadata = {
  title: "Topics",
  description: "Browse public repositories by subject, based on the topic tags maintainers assign on GitHub.",
};

export default function TopicsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Topics" description="Browse repositories by subject." />
      <MethodNote>
        A repository appears under a subject when its maintainers tagged it with one of that subject&apos;s GitHub topics.
        RepoAtlas does not guess categories from code, so untagged projects won&apos;t appear here; use{" "}
        <Link href="/explore" className="text-primary hover:underline">
          Explore
        </Link>{" "}
        to search their descriptions instead.
      </MethodNote>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOPIC_CATEGORIES.map((c) => (
          <li key={c.slug} className="flex flex-col rounded-lg border bg-card p-4">
            <h2 className="font-semibold">
              <Link href={`/topics/${c.topics[0]}`} className="hover:underline">
                {c.name}
              </Link>
            </h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{c.description}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`${c.name} topics`}>
              {c.topics.map((t) => (
                <li key={t}>
                  <Link href={`/topics/${t}`} className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground hover:bg-primary/15">
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
