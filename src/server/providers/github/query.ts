import { AppError } from "@/lib/errors";
import type { SearchSpec } from "@/lib/validation/search";

/** GitHub rejects search queries longer than 256 characters. */
export const GITHUB_MAX_QUERY_LENGTH = 256;

export interface QueryPart {
  qualifier: string;
  explanation: string;
}

export interface BuiltQuery {
  /** The exact `q` parameter sent to GitHub. */
  q: string;
  sort?: "stars" | "forks" | "help-wanted-issues" | "updated";
  order: "asc" | "desc";
  parts: QueryPart[];
}

const DAY = 86_400_000;

function isoDay(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function quote(value: string) {
  return /\s/.test(value) ? `"${value.replace(/"/g, "")}"` : value;
}

function range(name: string, min?: number, max?: number): string | null {
  if (min !== undefined && max !== undefined) return `${name}:${min}..${max}`;
  if (min !== undefined) return `${name}:>=${min}`;
  if (max !== undefined) return `${name}:<=${max}`;
  return null;
}

function dateRange(
  name: "created" | "pushed",
  preset: string | undefined,
  from: string | undefined,
  to: string | undefined,
  now: number,
): string | null {
  switch (preset) {
    case "24h":
      return `${name}:>=${new Date(now - DAY).toISOString().slice(0, 19)}Z`;
    case "7d":
      return `${name}:>=${isoDay(now - 7 * DAY)}`;
    case "30d":
      return `${name}:>=${isoDay(now - 30 * DAY)}`;
    case "90d":
      return `${name}:>=${isoDay(now - 90 * DAY)}`;
    case "1y":
      return `${name}:>=${isoDay(now - 365 * DAY)}`;
    default:
      if (from && to) return `${name}:${from}..${to}`;
      if (from) return `${name}:>=${from}`;
      if (to) return `${name}:<=${to}`;
      return null;
  }
}

/**
 * Translates a SearchSpec into GitHub repository-search syntax.
 * Semantics verified against the live API: repeated `language:` and `license:` qualifiers
 * are OR-ed, repeated `topic:` qualifiers are AND-ed.
 */
export function buildGitHubQuery(spec: SearchSpec, now: number = Date.now()): BuiltQuery {
  const parts: QueryPart[] = [];
  const add = (qualifier: string | null, explanation: string) => {
    if (qualifier) parts.push({ qualifier, explanation });
  };

  if (spec.q) add(spec.q, "Free text, matched against name, description and topics (GitHub qualifiers allowed)");
  for (const l of spec.language) add(`language:${quote(l)}`, `Primary language is ${l} (any of the selected)`);
  for (const t of spec.topic) add(`topic:${t}`, `Tagged with topic "${t}" (all selected topics required)`);
  for (const l of spec.license) add(`license:${l}`, `License is ${l} (any of the selected)`);
  if (spec.owner) add(`user:${spec.owner}`, `Owned by user or organization ${spec.owner}`);
  add(range("stars", spec.minStars, spec.maxStars), "Star count range");
  add(range("forks", spec.minForks, spec.maxForks), "Fork count range");
  add(range("size", spec.minSize, spec.maxSize), "Repository size in KB");
  if (spec.minGoodFirstIssues !== undefined) {
    add(`good-first-issues:>=${spec.minGoodFirstIssues}`, "Open issues labelled good first issue");
  }
  add(
    dateRange("created", spec.created, spec.createdFrom, spec.createdTo, now),
    "Repository creation date",
  );
  add(
    dateRange("pushed", spec.pushed, spec.pushedFrom, spec.pushedTo, now),
    "Last push (commit activity on any branch)",
  );
  if (spec.archived === "exclude") add("archived:false", "Archived repositories excluded");
  if (spec.archived === "only") add("archived:true", "Only archived repositories");
  if (spec.fork === "include") add("fork:true", "Forks included alongside source repositories");
  if (spec.fork === "only") add("fork:only", "Only forks");

  if (parts.length === 0) add("is:public", "All public repositories");

  const q = parts.map((p) => p.qualifier).join(" ");
  if (q.length > GITHUB_MAX_QUERY_LENGTH) {
    throw new AppError(
      "INVALID_INPUT",
      `This search is too long for GitHub (${q.length} of ${GITHUB_MAX_QUERY_LENGTH} characters). Remove some filters or shorten the text.`,
    );
  }

  return {
    q,
    sort: spec.sort === "best" ? undefined : spec.sort,
    order: spec.order,
    parts,
  };
}
