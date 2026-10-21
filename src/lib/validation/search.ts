import { z } from "zod";

/**
 * SearchSpec is the single, validated representation of a repository search. URL query
 * parameters, saved searches and (later) AI-generated searches are all converted into a
 * SearchSpec and run through the same search service.
 */

export const CREATED_PRESETS = ["7d", "30d", "90d", "1y", "custom"] as const;
export const PUSHED_PRESETS = ["24h", "7d", "30d", "90d", "custom"] as const;
export const TRI_STATE = ["exclude", "include", "only"] as const;
export const SORTS = ["best", "stars", "forks", "updated", "help-wanted-issues"] as const;
export const PER_PAGE = [10, 20, 30, 50] as const;

/** GitHub's Search API never returns more than this many results for one query. */
export const MAX_SEARCH_RESULTS = 1000;

export type CreatedPreset = (typeof CREATED_PRESETS)[number];
export type PushedPreset = (typeof PUSHED_PRESETS)[number];
export type TriState = (typeof TRI_STATE)[number];
export type SortMode = (typeof SORTS)[number];

const language = z.string().regex(/^[A-Za-z0-9+#. _'-]{1,40}$/, "Invalid language name");
const topic = z
  .string()
  .transform((s) => s.toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9][a-z0-9-]{0,49}$/, "Invalid topic"));
const license = z
  .string()
  .transform((s) => s.toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9][a-z0-9.+-]{0,39}$/, "Invalid license key"));
const owner = z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, "Invalid owner name");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const count = z.coerce.number().int().min(0).max(10_000_000);

export const searchSpecSchema = z
  .object({
    q: z
      .string()
      .max(200, "Search text is limited to 200 characters")
      .transform((s) => s.replace(/[\u0000-\u001f]/g, " ").trim())
      .default(""),
    language: z.array(language).max(5).default([]),
    topic: z.array(topic).max(5).default([]),
    license: z.array(license).max(5).default([]),
    owner: owner.optional(),
    minStars: count.optional(),
    maxStars: count.optional(),
    minForks: count.optional(),
    maxForks: count.optional(),
    minSize: count.optional(),
    maxSize: count.optional(),
    minGoodFirstIssues: count.optional(),
    created: z.enum(CREATED_PRESETS).optional(),
    createdFrom: isoDate.optional(),
    createdTo: isoDate.optional(),
    pushed: z.enum(PUSHED_PRESETS).optional(),
    pushedFrom: isoDate.optional(),
    pushedTo: isoDate.optional(),
    archived: z.enum(TRI_STATE).default("include"),
    fork: z.enum(TRI_STATE).default("exclude"),
    sort: z.enum(SORTS).default("best"),
    order: z.enum(["desc", "asc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce
      .number()
      .int()
      .refine((n) => (PER_PAGE as readonly number[]).includes(n), "Unsupported page size")
      .default(20),
  })
  .superRefine((s, ctx) => {
    const ranges: [keyof typeof s, keyof typeof s][] = [
      ["minStars", "maxStars"],
      ["minForks", "maxForks"],
      ["minSize", "maxSize"],
      ["createdFrom", "createdTo"],
      ["pushedFrom", "pushedTo"],
    ];
    for (const [lo, hi] of ranges) {
      const a = s[lo];
      const b = s[hi];
      if (a !== undefined && b !== undefined && a > b) {
        ctx.addIssue({ code: "custom", path: [hi], message: `${String(hi)} must not be lower than ${String(lo)}` });
      }
    }
    if (s.page * s.perPage > MAX_SEARCH_RESULTS + s.perPage - 1) {
      ctx.addIssue({
        code: "custom",
        path: ["page"],
        message: `GitHub only returns the first ${MAX_SEARCH_RESULTS} results of a search`,
      });
    }
  });

export type SearchSpec = z.output<typeof searchSpecSchema>;
export type SearchSpecInput = z.input<typeof searchSpecSchema>;

export const DEFAULT_SPEC: SearchSpec = searchSpecSchema.parse({});

const LIST_KEYS = ["language", "topic", "license"] as const;
const SCALAR_KEYS = [
  "q",
  "owner",
  "minStars",
  "maxStars",
  "minForks",
  "maxForks",
  "minSize",
  "maxSize",
  "minGoodFirstIssues",
  "created",
  "createdFrom",
  "createdTo",
  "pushed",
  "pushedFrom",
  "pushedTo",
  "archived",
  "fork",
  "sort",
  "order",
  "page",
  "perPage",
] as const;

export type RawParams = Record<string, string | string[] | undefined>;

export interface ParamIssue {
  param: string;
  message: string;
}

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s.trim() === "" ? undefined : s.trim();
}

function list(v: string | string[] | undefined): string[] {
  const all = Array.isArray(v) ? v : v === undefined ? [] : [v];
  return [...new Set(all.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean))];
}

/**
 * Parses URL query parameters into a SearchSpec. Invalid parameters are dropped and
 * reported as issues (so the UI can tell the user) instead of failing the whole search
 * or being silently ignored.
 */
export function parseSearchParams(raw: RawParams | URLSearchParams): {
  spec: SearchSpec;
  issues: ParamIssue[];
} {
  const record: RawParams =
    raw instanceof URLSearchParams
      ? Object.fromEntries([...new Set(raw.keys())].map((k) => [k, raw.getAll(k)]))
      : raw;

  const input: Record<string, unknown> = {};
  for (const k of LIST_KEYS) {
    const values = list(record[k]);
    if (values.length) input[k] = values;
  }
  for (const k of SCALAR_KEYS) {
    const v = first(record[k]);
    if (v !== undefined) input[k] = v;
  }

  const issues: ParamIssue[] = [];
  // Drop offending params one at a time until the remainder validates.
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = searchSpecSchema.safeParse(input);
    if (result.success) return { spec: result.data, issues };
    const issue = result.error.issues[0];
    const param = String(issue.path[0] ?? "unknown");
    issues.push({ param, message: issue.message });
    if (param === "unknown" || !(param in input)) break;
    if (LIST_KEYS.includes(param as (typeof LIST_KEYS)[number]) && typeof issue.path[1] === "number") {
      const arr = input[param] as string[];
      arr.splice(issue.path[1], 1);
      if (!arr.length) delete input[param];
    } else {
      delete input[param];
    }
  }
  return { spec: DEFAULT_SPEC, issues };
}

/** Serializes a spec to URL params, omitting defaults so URLs stay short and shareable. */
export function specToSearchParams(spec: Partial<SearchSpec>): URLSearchParams {
  const params = new URLSearchParams();
  for (const k of LIST_KEYS) {
    const v = spec[k];
    if (v && v.length) params.set(k, v.join(","));
  }
  for (const k of SCALAR_KEYS) {
    const v = spec[k];
    if (v === undefined || v === "") continue;
    if (DEFAULT_SPEC[k] === v) continue;
    params.set(k, String(v));
  }
  return params;
}

export function specToQueryString(spec: Partial<SearchSpec>): string {
  const s = specToSearchParams(spec).toString();
  return s ? `?${s}` : "";
}

/** True when the spec contains anything beyond defaults (pagination excluded). */
export function hasCriteria(spec: SearchSpec): boolean {
  const params = specToSearchParams({
    ...spec,
    page: DEFAULT_SPEC.page,
    perPage: DEFAULT_SPEC.perPage,
    sort: DEFAULT_SPEC.sort,
    order: DEFAULT_SPEC.order,
  });
  return [...params.keys()].length > 0;
}

/** Highest page number that GitHub will serve for the given page size. */
export function maxPage(perPage: number, totalCount: number): number {
  const reachable = Math.min(totalCount, MAX_SEARCH_RESULTS);
  return Math.max(1, Math.ceil(reachable / perPage));
}
