import { AlertTriangle, Clock, Inbox, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { DataFreshness } from "@/lib/cache/cached-fetch";
import { formatRelative } from "@/lib/format";
import type { AppError } from "@/lib/errors";
import { cn } from "@/lib/utils";

const TITLES: Partial<Record<AppError["code"], string>> = {
  UPSTREAM_RATE_LIMITED: "GitHub rate limit reached",
  UPSTREAM_INVALID_QUERY: "GitHub could not run this search",
  UPSTREAM_UNAVAILABLE: "GitHub is not responding",
  UPSTREAM_BAD_RESPONSE: "Unexpected data from GitHub",
  INVALID_INPUT: "This search needs a change",
  NOT_FOUND: "Not found",
  RATE_LIMITED: "Too many requests",
};

/** Recoverable error panel. Shows only the safe user message, never internals. */
export function ErrorState({ error, retryHref, className }: { error: AppError; retryHref?: string; className?: string }) {
  const title = TITLES[error.code] ?? "Something went wrong";
  return (
    <div role="alert" className={cn("rounded-lg border border-destructive/30 bg-destructive/5 p-5", className)} data-testid="error-state">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <div className="space-y-2">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-foreground/80">{error.userMessage}</p>
          {error.retryAfter !== undefined && error.retryAfter > 0 && (
            <p className="text-sm text-muted-foreground">
              Try again in about {error.retryAfter < 90 ? `${error.retryAfter} seconds` : `${Math.ceil(error.retryAfter / 60)} minutes`}.
            </p>
          )}
          {retryHref && (
            <Link href={retryHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <RefreshCw className="size-3.5" aria-hidden /> Try again
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center" data-testid="empty-state">
      <Inbox className="mx-auto size-6 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-medium">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

const CACHE_SUFFIX: Record<DataFreshness["cache"], string> = {
  miss: "",
  hit: " (cached)",
  revalidated: " (checked, unchanged)",
  "stale-fallback": ". GitHub is unavailable, so this is an older cached copy",
};

/** "Fetched from GitHub 4 minutes ago (cached)". */
export function FreshnessNote({ freshness, now, className }: { freshness: DataFreshness; now: number; className?: string }) {
  const stale = freshness.cache === "stale-fallback";
  return (
    <p className={cn("flex items-center gap-1.5 text-xs", stale ? "text-warning" : "text-muted-foreground", className)} data-testid="freshness">
      <Clock className="size-3.5 shrink-0" aria-hidden />
      <span>
        Fetched from GitHub <time dateTime={freshness.fetchedAt}>{formatRelative(freshness.fetchedAt, now)}</time>
        {CACHE_SUFFIX[freshness.cache]}
      </span>
    </p>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-lg border bg-card px-3" aria-busy="true" aria-label="Loading repositories">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3 border-b py-4 last:border-b-0">
          <div className="size-6 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
