import type { RepositorySummary } from "@/types/repository";

export interface Tally {
  name: string;
  count: number;
  /** Share of the sample (0–1). */
  share: number;
}

/**
 * Counts values across a known sample of repositories. Results describe that sample only
 * (callers must say which sample), never GitHub as a whole.
 */
export function tally(repos: RepositorySummary[], pick: (r: RepositorySummary) => string[] | string | null, limit = 10): Tally[] {
  const counts = new Map<string, number>();
  for (const r of repos) {
    const v = pick(r);
    const values = v === null ? [] : Array.isArray(v) ? v : [v];
    for (const x of new Set(values)) counts.set(x, (counts.get(x) ?? 0) + 1);
  }
  const total = repos.length || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count, share: count / total }));
}
