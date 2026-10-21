import { X } from "lucide-react";
import Link from "next/link";
import { buildFilterChips, clearFilters } from "@/features/repository-search/chips";
import { specToQueryString, type SearchSpec } from "@/lib/validation/search";

/** Active filters as removable chips. Plain links: removing a filter works without JavaScript. */
export function FilterChips({ spec, basePath, locked = [] }: { spec: SearchSpec; basePath: string; locked?: (keyof SearchSpec)[] }) {
  const chips = buildFilterChips(spec, locked);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters" data-testid="filter-chips">
      {chips.map((c) => (
        <Link
          key={c.key}
          href={`${basePath}${specToQueryString(c.without)}`}
          className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pl-3 pr-2 text-xs hover:border-destructive/50 hover:text-destructive"
          aria-label={`Remove filter: ${c.label}`}
        >
          {c.label}
          <X className="size-3.5" aria-hidden />
        </Link>
      ))}
      {chips.length > 1 && (
        <Link
          href={`${basePath}${specToQueryString(clearFilters(spec, locked))}`}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Clear all filters
        </Link>
      )}
    </div>
  );
}
