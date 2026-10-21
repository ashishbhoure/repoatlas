import { CircleDot, GitFork, Star } from "lucide-react";
import { LANGUAGE_COLORS } from "@/config/filters";
import { formatCount, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StarCount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 tabular", className)} title={`${formatNumber(value)} stars`}>
      <Star className="size-3.5 fill-star/20 text-star" aria-hidden />
      <span>{formatCount(value)}</span>
      <span className="sr-only"> stars</span>
    </span>
  );
}

export function ForkCount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 tabular", className)} title={`${formatNumber(value)} forks`}>
      <GitFork className="size-3.5 text-muted-foreground" aria-hidden />
      <span>{formatCount(value)}</span>
      <span className="sr-only"> forks</span>
    </span>
  );
}

export function IssueCount({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 tabular", className)}
      title={`${formatNumber(value)} open issues and pull requests (GitHub counts both)`}
    >
      <CircleDot className="size-3.5 text-muted-foreground" aria-hidden />
      <span>{formatCount(value)}</span>
      <span className="sr-only"> open issues and pull requests</span>
    </span>
  );
}

export function LanguageTag({ language }: { language: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-2.5 rounded-full border border-foreground/10"
        style={{ backgroundColor: LANGUAGE_COLORS[language] ?? "var(--muted-foreground)" }}
        aria-hidden
      />
      {language}
    </span>
  );
}
