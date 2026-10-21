import { Archive } from "lucide-react";
import Link from "next/link";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HealthScore } from "@/server/ranking/health";

function band(score: number) {
  if (score >= 75) return { label: "Strong signals", cls: "text-success" };
  if (score >= 50) return { label: "Mixed signals", cls: "text-foreground" };
  return { label: "Weak signals", cls: "text-warning" };
}

export function HealthCard({ health, now }: { health: HealthScore; now: number }) {
  const b = health.score !== null ? band(health.score) : null;
  return (
    <section aria-labelledby="health-title" className="rounded-lg border bg-card p-5" data-testid="health-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="health-title" className="font-semibold">
            Health score
          </h2>
          <p className="text-xs text-muted-foreground">
            Derived by RepoAtlas ({health.version}) from public GitHub data. Not an official metric and not a security or
            quality guarantee.
          </p>
        </div>
        <div className="text-right">
          {health.score === null ? (
            <p className="text-sm font-medium">Not enough data</p>
          ) : (
            <p className="leading-none">
              <span className="text-4xl font-semibold tabular">{health.score}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </p>
          )}
          {b && <p className={cn("mt-1 text-xs font-medium", b.cls)}>{b.label}</p>}
        </div>
      </div>

      {health.status !== "ok" && (
        <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs">
          {health.status === "provisional"
            ? `Provisional: only ${Math.round(health.coverage * 100)}% of the scoring weight had data, so this score may shift as more becomes available.`
            : `Only ${Math.round(health.coverage * 100)}% of the scoring weight had data, which is too little for a meaningful score.`}
        </p>
      )}
      {health.archived && (
        <p className="mt-3 flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs">
          <Archive className="size-3.5" aria-hidden /> This repository is archived: it is read-only and no longer maintained here.
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {health.dimensions.map((d) => (
          <li key={d.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{d.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular">
                {d.score === null ? "not scored" : `${Math.round(d.score * 100)}/100`}, weight {d.weight}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden>
              {d.score !== null && <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.round(d.score * 100))}%` }} />}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{d.detail}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">
        Computed {formatRelative(health.computedAt, now)}. Open issues are deliberately not scored, since they grow with
        popularity. <Link href="/methodology#health-score" className="text-primary hover:underline">Read the methodology</Link>.
      </p>
    </section>
  );
}
