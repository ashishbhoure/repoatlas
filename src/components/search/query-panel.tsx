import { Code2 } from "lucide-react";
import type { QueryExplanation } from "@/server/providers/types";

/** Shows the exact GitHub query that produced the results, and what each part means. */
export function QueryPanel({ query }: { query: QueryExplanation }) {
  return (
    <details className="group rounded-lg border bg-card text-sm" data-testid="query-panel">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <Code2 className="size-4" aria-hidden />
        <span>How this search was sent to GitHub</span>
      </summary>
      <div className="space-y-3 border-t px-4 py-3">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Query</p>
          <code className="block overflow-x-auto whitespace-pre rounded-md bg-muted px-3 py-2 font-mono text-[0.8rem]">{query.native}</code>
        </div>
        <p className="text-xs text-muted-foreground">
          Sorted by {query.sort}
          {query.sort !== "best match" && `, ${query.order === "desc" ? "descending" : "ascending"}`}. Ordering is
          performed by GitHub across all matches.
        </p>
        <ul className="space-y-1">
          {query.parts.map((p) => (
            <li key={p.qualifier} className="grid gap-x-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
              <code className="truncate font-mono text-[0.8rem] text-foreground">{p.qualifier}</code>
              <span className="text-muted-foreground">{p.explanation}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
