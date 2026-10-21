import type { z } from "zod";
import { cachedFetch, type CachePolicy, type DataFreshness } from "@/lib/cache/cached-fetch";
import { cacheKey, type CacheStore } from "@/lib/cache/store";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/observability/logger";

export interface RateLimitInfo {
  resource: string;
  limit: number;
  remaining: number;
  /** Epoch seconds when the window resets. */
  reset: number;
  observedAt: string;
}

export interface GitHubClientOptions {
  baseUrl: string;
  token?: string;
  store: CacheStore;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Retries for network errors and 5xx responses. */
  maxRetries?: number;
  /** Longest Retry-After (seconds) we are willing to wait inside a user request. */
  maxInlineWaitSeconds?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface GetOptions<S extends z.ZodTypeAny, R> {
  query?: Record<string, string | number | undefined>;
  accept?: string;
  schema: S;
  transform: (data: z.output<S>) => R;
  policy: CachePolicy;
  /** Return null (and cache it) instead of throwing on 404. */
  allowNotFound?: boolean;
  /** Return null without caching on 202 (GitHub statistics still being computed). */
  allowAccepted?: boolean;
}

type RawResult =
  | { kind: "data"; body: unknown; etag: string | null }
  | { kind: "not-modified" }
  | { kind: "not-found" }
  | { kind: "accepted" };

const NO_DATA = Symbol("no-data");
/** Serializable marker cached for "known not to exist" (404 with allowNotFound). */
const NO_DATA_MARKER = "__repoatlas_not_found__" as const;

/** Per-instance view of the most recent rate-limit headers, per GitHub resource. */
const rateLimits = new Map<string, RateLimitInfo>();

export function getObservedRateLimits(): RateLimitInfo[] {
  return [...rateLimits.values()];
}

export class GitHubClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly maxInlineWait: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(private readonly opts: GitHubClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.maxInlineWait = opts.maxInlineWaitSeconds ?? 3;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? Date.now;
  }

  get authenticated() {
    return Boolean(this.opts.token);
  }

  /**
   * Cached, validated GET. Returns `value: null` only when allowNotFound/allowAccepted
   * permitted a 404/202. The cache key covers path, query, accept header and auth mode.
   */
  async get<S extends z.ZodTypeAny, R>(
    path: string,
    options: GetOptions<S, R>,
  ): Promise<{ value: R | null; freshness: DataFreshness }> {
    const key = cacheKey("gh", {
      v: 1,
      path,
      query: options.query ?? {},
      accept: options.accept ?? null,
    });

    let accepted = false;
    try {
      const result = await cachedFetch<R | typeof NO_DATA_MARKER>(
        this.opts.store,
        key,
        options.policy,
        async (etag) => {
          const raw = await this.request(path, options.query, options.accept, etag);
          if (raw.kind === "not-modified") return { kind: "not-modified" };
          if (raw.kind === "accepted") {
            accepted = true;
            throw NO_DATA;
          }
          if (raw.kind === "not-found") {
            if (!options.allowNotFound) {
              throw new AppError("NOT_FOUND", "That repository or resource was not found on GitHub.");
            }
            return { kind: "data", value: NO_DATA_MARKER, etag: null };
          }
          const parsed = options.schema.safeParse(raw.body);
          if (!parsed.success) {
            log.error("github.response_invalid", { path, issues: parsed.error.issues.slice(0, 5) });
            throw new AppError("UPSTREAM_BAD_RESPONSE", "GitHub returned data in an unexpected format.");
          }
          return { kind: "data", value: options.transform(parsed.data), etag: raw.etag };
        },
        this.now,
      );
      return {
        value: result.value === NO_DATA_MARKER ? null : (result.value as R),
        freshness: result.freshness,
      };
    } catch (e) {
      if (e === NO_DATA && accepted && options.allowAccepted) {
        return { value: null, freshness: { fetchedAt: new Date(this.now()).toISOString(), cache: "miss" } };
      }
      if (e === NO_DATA) {
        throw new AppError("UPSTREAM_UNAVAILABLE", "GitHub is still preparing this data. Try again shortly.");
      }
      throw e;
    }
  }

  private async request(
    path: string,
    query: Record<string, string | number | undefined> | undefined,
    accept: string | undefined,
    etag: string | null,
  ): Promise<RawResult> {
    const url = new URL(path.replace(/^\//, ""), this.opts.baseUrl.replace(/\/?$/, "/"));
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      Accept: accept ?? "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "RepoAtlas",
    };
    if (this.opts.token) headers.Authorization = `Bearer ${this.opts.token}`;
    if (etag) headers["If-None-Match"] = etag;

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          headers,
          signal: AbortSignal.timeout(this.timeoutMs),
          cache: "no-store",
        });
      } catch (e) {
        if (attempt < this.maxRetries) {
          await this.sleep(this.backoff(attempt));
          continue;
        }
        log.warn("github.network_error", { path, error: e });
        throw new AppError("UPSTREAM_UNAVAILABLE", "Could not reach GitHub. Please try again.", { cause: e });
      }

      this.recordRateLimit(res.headers);

      if (res.status === 304) return { kind: "not-modified" };
      if (res.status === 202) return { kind: "accepted" };
      if (res.status === 404 || res.status === 451 || res.status === 409) {
        // 409: empty repository (no commits) for content endpoints.
        return { kind: "not-found" };
      }
      if (res.ok) {
        const text = await res.text();
        let body: unknown;
        try {
          body = accept?.includes("html") ? text : JSON.parse(text);
        } catch (e) {
          throw new AppError("UPSTREAM_BAD_RESPONSE", "GitHub returned malformed data.", { cause: e });
        }
        return { kind: "data", body, etag: res.headers.get("etag") };
      }

      if (res.status === 403 || res.status === 429) {
        const wait = this.rateLimitWait(res.headers);
        if (wait !== null) {
          if (wait <= this.maxInlineWait && attempt < this.maxRetries) {
            await this.sleep(wait * 1000 + this.jitter());
            continue;
          }
          throw new AppError(
            "UPSTREAM_RATE_LIMITED",
            this.authenticated
              ? "GitHub's rate limit was reached. Results will be available again shortly."
              : "GitHub's anonymous rate limit was reached. Configure GITHUB_TOKEN for higher limits.",
            { retryAfter: wait },
          );
        }
        log.warn("github.forbidden", { path, status: res.status });
        throw new AppError("UPSTREAM_UNAVAILABLE", "GitHub declined this request.");
      }

      if (res.status === 422) {
        const message = await this.errorMessage(res);
        throw new AppError("UPSTREAM_INVALID_QUERY", `GitHub could not process this search: ${message}`);
      }

      if (res.status >= 500 && attempt < this.maxRetries) {
        await this.sleep(this.backoff(attempt));
        continue;
      }

      log.warn("github.unexpected_status", { path, status: res.status });
      throw new AppError("UPSTREAM_UNAVAILABLE", "GitHub is having trouble right now. Please try again.");
    }
  }

  /** Seconds to wait if this 403/429 is a rate limit; null when it is some other refusal. */
  private rateLimitWait(h: Headers): number | null {
    const retryAfter = h.get("retry-after");
    if (retryAfter && /^\d+$/.test(retryAfter)) return Number(retryAfter);
    if (h.get("x-ratelimit-remaining") === "0") {
      const reset = Number(h.get("x-ratelimit-reset"));
      if (Number.isFinite(reset)) return Math.max(1, Math.ceil(reset - this.now() / 1000));
      return 60;
    }
    return null;
  }

  private backoff(attempt: number) {
    return 250 * 2 ** attempt + this.jitter();
  }

  private jitter() {
    return Math.floor(Math.random() * 250);
  }

  private async errorMessage(res: Response): Promise<string> {
    try {
      const body = (await res.json()) as { message?: string; errors?: { message?: string }[] };
      const detail = body.errors?.find((e) => e.message)?.message ?? body.message ?? "validation failed";
      return detail.slice(0, 200);
    } catch {
      return "validation failed";
    }
  }

  private recordRateLimit(h: Headers) {
    const resource = h.get("x-ratelimit-resource");
    const limit = h.get("x-ratelimit-limit");
    const remaining = h.get("x-ratelimit-remaining");
    const reset = h.get("x-ratelimit-reset");
    if (!resource || limit === null || remaining === null || reset === null) return;
    rateLimits.set(resource, {
      resource,
      limit: Number(limit),
      remaining: Number(remaining),
      reset: Number(reset),
      observedAt: new Date(this.now()).toISOString(),
    });
  }
}

