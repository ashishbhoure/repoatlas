import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { specToQueryString, type SearchSpec } from "@/lib/validation/search";
import { cn } from "@/lib/utils";

/** Page numbers to show: first, last, current ±1, with gaps. */
export function pageWindow(current: number, last: number): (number | "gap")[] {
  const pages = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function Pagination({ spec, lastPage, basePath }: { spec: SearchSpec; lastPage: number; basePath: string }) {
  if (lastPage <= 1) return null;
  const href = (page: number) => `${basePath}${specToQueryString({ ...spec, page })}`;
  const cur = Math.min(spec.page, lastPage);
  const linkCls = "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm hover:bg-muted";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1" data-testid="pagination">
      {cur > 1 ? (
        <Link href={href(cur - 1)} className={linkCls} rel="prev">
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
      ) : (
        <span className={cn(linkCls, "pointer-events-none opacity-40")} aria-disabled="true">
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </span>
      )}
      {pageWindow(cur, lastPage).map((p, i) =>
        p === "gap" ? (
          <span key={`g${i}`} className="px-1 text-muted-foreground" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === cur ? "page" : undefined}
            aria-label={`Page ${p}`}
            className={cn(linkCls, "tabular", p === cur && "bg-primary text-primary-foreground hover:bg-primary")}
          >
            {p}
          </Link>
        ),
      )}
      {cur < lastPage ? (
        <Link href={href(cur + 1)} className={linkCls} rel="next">
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className={cn(linkCls, "pointer-events-none opacity-40")} aria-disabled="true">
          Next <ChevronRight className="size-4" aria-hidden />
        </span>
      )}
    </nav>
  );
}
