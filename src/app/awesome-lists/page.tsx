import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/feedback/states";
import { MethodNote, PageHeader } from "@/components/layout/page-header";
import { SearchBox } from "@/components/search/search-controls";
import { SearchResults } from "@/components/search/search-results";
import { parseSearchParams, specToQueryString, type SearchSpec } from "@/lib/validation/search";

export const metadata: Metadata = {
  title: "Awesome Lists",
  description: "Community-curated lists of developer resources, found by their awesome-list topic tag.",
};

export default function AwesomeListsPage({ searchParams }: PageProps<"/awesome-lists">) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="Awesome lists" description="Curated lists of libraries, tools and learning resources, maintained by the community." />
      <MethodNote>
        <p>
          RepoAtlas finds curated lists by GitHub&apos;s <code className="font-mono text-xs">awesome-list</code> topic tag
          and orders them by stars. These lists are maintained by their own authors, not by RepoAtlas; they are not
          guaranteed to be complete or current. Open a list to browse its sections from the README.
        </p>
      </MethodNote>
      <Suspense fallback={<ListSkeleton />}>
        <AwesomeContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AwesomeContent({ searchParams }: Pick<PageProps<"/awesome-lists">, "searchParams">) {
  const { spec: userSpec } = parseSearchParams(await searchParams);
  const spec: SearchSpec = { ...userSpec, topic: ["awesome-list"], sort: "stars", archived: userSpec.archived };
  return (
    <div className="space-y-4">
      <SearchBox key={spec.q} spec={spec} basePath="/awesome-lists" />
      <Suspense key={specToQueryString(spec)} fallback={<ListSkeleton />}>
        <SearchResults spec={spec} basePath="/awesome-lists" ranked />
      </Suspense>
    </div>
  );
}
