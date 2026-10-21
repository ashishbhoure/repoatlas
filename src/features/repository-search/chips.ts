import { CREATED_LABELS, licenseName, PUSHED_LABELS } from "@/config/filters";
import { DEFAULT_SPEC, type SearchSpec } from "@/lib/validation/search";

export interface FilterChip {
  key: string;
  label: string;
  /** Spec with this one filter removed (page reset to 1). */
  without: SearchSpec;
}

const n = (v: number) => v.toLocaleString("en-US");

function rangeLabel(noun: string, min?: number, max?: number) {
  if (min !== undefined && max !== undefined) return `${n(min)}–${n(max)} ${noun}`;
  if (min !== undefined) return `≥ ${n(min)} ${noun}`;
  return `≤ ${n(max!)} ${noun}`;
}

/**
 * One removable chip per active filter. `locked` keys belong to a discovery view's
 * definition and are not offered for removal.
 */
export function buildFilterChips(spec: SearchSpec, locked: (keyof SearchSpec)[] = []): FilterChip[] {
  const chips: FilterChip[] = [];
  const base = { ...spec, page: 1 };
  const isLocked = (k: keyof SearchSpec) => locked.includes(k);

  for (const key of ["language", "topic", "license"] as const) {
    if (isLocked(key)) continue;
    for (const v of spec[key]) {
      const label = key === "license" ? `License: ${licenseName(v)}` : key === "topic" ? `Topic: ${v}` : v;
      chips.push({ key: `${key}:${v}`, label, without: { ...base, [key]: spec[key].filter((x) => x !== v) } });
    }
  }
  if (spec.owner && !isLocked("owner")) {
    chips.push({ key: "owner", label: `Owner: ${spec.owner}`, without: { ...base, owner: undefined } });
  }
  const ranges = [
    ["stars", "minStars", "maxStars"],
    ["forks", "minForks", "maxForks"],
    ["KB", "minSize", "maxSize"],
  ] as const;
  for (const [noun, lo, hi] of ranges) {
    if ((spec[lo] !== undefined || spec[hi] !== undefined) && !isLocked(lo)) {
      chips.push({ key: noun, label: rangeLabel(noun, spec[lo], spec[hi]), without: { ...base, [lo]: undefined, [hi]: undefined } });
    }
  }
  if (spec.minGoodFirstIssues !== undefined && !isLocked("minGoodFirstIssues")) {
    chips.push({ key: "gfi", label: `≥ ${spec.minGoodFirstIssues} good first issues`, without: { ...base, minGoodFirstIssues: undefined } });
  }
  if ((spec.created || spec.createdFrom || spec.createdTo) && !isLocked("created")) {
    const label =
      spec.created && spec.created !== "custom"
        ? CREATED_LABELS[spec.created]
        : `Created ${spec.createdFrom ?? "…"} to ${spec.createdTo ?? "today"}`;
    chips.push({ key: "created", label, without: { ...base, created: undefined, createdFrom: undefined, createdTo: undefined } });
  }
  if ((spec.pushed || spec.pushedFrom || spec.pushedTo) && !isLocked("pushed")) {
    const label =
      spec.pushed && spec.pushed !== "custom"
        ? PUSHED_LABELS[spec.pushed]
        : `Pushed ${spec.pushedFrom ?? "…"} to ${spec.pushedTo ?? "today"}`;
    chips.push({ key: "pushed", label, without: { ...base, pushed: undefined, pushedFrom: undefined, pushedTo: undefined } });
  }
  if (spec.archived !== DEFAULT_SPEC.archived && !isLocked("archived")) {
    chips.push({
      key: "archived",
      label: spec.archived === "exclude" ? "Archived excluded" : "Archived only",
      without: { ...base, archived: DEFAULT_SPEC.archived },
    });
  }
  if (spec.fork !== DEFAULT_SPEC.fork && !isLocked("fork")) {
    chips.push({
      key: "fork",
      label: spec.fork === "include" ? "Forks included" : "Forks only",
      without: { ...base, fork: DEFAULT_SPEC.fork },
    });
  }
  return chips;
}

/** Spec with every removable filter cleared, keeping text, sort and locked keys. */
export function clearFilters(spec: SearchSpec, locked: (keyof SearchSpec)[] = []): SearchSpec {
  const cleared: SearchSpec = { ...DEFAULT_SPEC, q: spec.q, sort: spec.sort, order: spec.order, perPage: spec.perPage };
  for (const k of locked) (cleared as Record<string, unknown>)[k] = spec[k];
  return cleared;
}
