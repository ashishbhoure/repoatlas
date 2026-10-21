"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ExplainedFactor {
  label: string;
  /** Weight as a fraction (0–1) or percentage points, displayed as given by `weightLabel`. */
  weightLabel: string;
  score: number | null;
  detail: string;
}

/** A score badge that opens a breakdown of its inputs, weights and algorithm version. */
export function ScoreExplainer({
  label,
  score,
  version,
  factors,
  note,
  tone = "primary",
}: {
  label: string;
  score: number | null;
  version: string;
  factors: ExplainedFactor[];
  note?: string;
  tone?: "primary" | "muted";
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative z-10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular hover:border-primary",
            tone === "primary" ? "border-primary/40 bg-accent text-accent-foreground" : "text-muted-foreground",
          )}
          aria-label={`${label}: ${score ?? "unavailable"}. Show how it was calculated`}
        >
          {label} {score ?? "n/a"}
          <Info className="size-3" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm" align="end">
        <p className="font-medium">
          {label}: {score ?? "unavailable"}
        </p>
        <p className="text-xs text-muted-foreground">Algorithm {version}. Derived by RepoAtlas, not a GitHub metric.</p>
        <ul className="mt-3 space-y-2.5">
          {factors.map((f) => (
            <li key={f.label}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{f.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular">
                  {f.score === null ? "not scored" : `${Math.round(f.score * 100)}/100`}, weight {f.weightLabel}
                </span>
              </div>
              {f.score !== null && (
                <div className="mt-1 h-1 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(f.score * 100)}%` }} />
                </div>
              )}
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.detail}</p>
            </li>
          ))}
        </ul>
        {note && <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">{note}</p>}
      </PopoverContent>
    </Popover>
  );
}
