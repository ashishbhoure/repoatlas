import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { env, features } from "@/config/env";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/observability/logger";
import { searchSpecSchema, type SearchSpec } from "@/lib/validation/search";
import { LICENSES } from "@/config/filters";

/**
 * Natural-language search, phase 1: the model only proposes a structured filter object.
 * That object is validated (fixed fields, enums, ranges), converted to a SearchSpec, and
 * shown to the user for correction. RepoAtlas never executes model-written query syntax,
 * and the model never produces repositories or metrics — results always come from the
 * regular GitHub search.
 */

export const AI_MODEL = "claude-opus-5-5";

const interpretation = z.object({
  keywords: z.array(z.string()).describe("Plain words describing what the repository does, e.g. ['authentication']"),
  languages: z.array(z.string()).describe("Primary programming languages as GitHub names them, e.g. 'TypeScript'"),
  topics: z.array(z.string()).describe("GitHub topic tags (lowercase, hyphenated) the repository must have"),
  licenses: z.array(z.string()).describe("GitHub license keys, e.g. 'mit', 'apache-2.0'"),
  minStars: z.number().int().nullable(),
  maxStars: z.number().int().nullable(),
  minForks: z.number().int().nullable(),
  created: z.enum(["7d", "30d", "90d", "1y"]).nullable().describe("Only repositories created within this window"),
  pushed: z.enum(["24h", "7d", "30d", "90d"]).nullable().describe("Only repositories with a push within this window"),
  archived: z.enum(["include", "exclude", "only"]),
  sort: z.enum(["best", "stars", "forks", "updated"]),
  unsupported: z.array(z.string()).describe("Parts of the request that cannot be expressed with these filters"),
  explanation: z.string().describe("One or two plain sentences on how the request was interpreted"),
});

export type Interpretation = z.infer<typeof interpretation>;

const SYSTEM = `You convert a developer's request for open-source repositories into search filters for GitHub's repository search. Output only the structured object.

Fields and rules:
- keywords: short plain words matched against repository name, description and topics. No quotes, colons or search operators.
- languages: GitHub language names. Several languages mean "any of".
- topics: GitHub topic tags, lowercase with hyphens. Several topics mean "all of", so only add a topic when the request clearly requires it; prefer keywords for loose concepts.
- licenses: GitHub license keys only, from: ${LICENSES.map((l) => l.key).join(", ")}.
- minStars / maxStars / minForks: integers or null.
- "actively maintained" or "still maintained" means pushed within 90d and archived "exclude"; "recently active" means pushed within 30d. Say so in the explanation.
- "new" or "recent" projects means created within 90d unless a window is stated.
- sort: "stars" for popularity requests, "updated" for recency, otherwise "best".
- archived: "exclude" unless the user asks for archived projects.
- Put anything that cannot be expressed with these fields (for example contributor counts, download numbers, "used by", company names, quality judgements) in unsupported, in the user's words. Never guess repository names or numbers that were not in the request.
- explanation: plain, neutral, for the user; mention any assumption you made.`;

const KEYWORD = /^[\p{L}\p{N}][\p{L}\p{N} .+#-]{0,39}$/u;

/** Maps a validated interpretation onto a SearchSpec, reporting anything dropped. */
export function interpretationToSpec(i: Interpretation): { spec: SearchSpec; dropped: string[] } {
  const dropped: string[] = [];
  const keywords = i.keywords.map((k) => k.trim()).filter((k) => {
    const ok = KEYWORD.test(k);
    if (!ok && k) dropped.push(`keyword “${k.slice(0, 40)}”`);
    return ok;
  });
  const candidate = {
    q: keywords.slice(0, 6).join(" "),
    language: i.languages.slice(0, 5),
    topic: i.topics.slice(0, 5),
    license: i.licenses.slice(0, 5),
    minStars: i.minStars ?? undefined,
    maxStars: i.maxStars ?? undefined,
    minForks: i.minForks ?? undefined,
    created: i.created ?? undefined,
    pushed: i.pushed ?? undefined,
    archived: i.archived,
    sort: i.sort,
  };
  // Validate field by field so one bad value drops only itself.
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (value === undefined) continue;
    const r = searchSpecSchema.safeParse({ [key]: value });
    if (r.success) {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      const kept = value.filter((v) => searchSpecSchema.safeParse({ [key]: [v] }).success);
      value.filter((v) => !kept.includes(v)).forEach((v) => dropped.push(`${key} “${String(v).slice(0, 40)}”`));
      if (kept.length) out[key] = kept;
    } else {
      dropped.push(`${key} ${String(value)}`);
    }
  }
  const final = searchSpecSchema.safeParse(out);
  if (!final.success) {
    // e.g. min > max: keep the minimum only.
    delete out.maxStars;
    dropped.push("an inconsistent star range");
  }
  return { spec: searchSpecSchema.parse(out), dropped };
}

let client: Anthropic | undefined;

export async function interpretQuery(text: string): Promise<{ interpretation: Interpretation; spec: SearchSpec; dropped: string[] }> {
  if (!features.aiSearch()) {
    throw new AppError("FEATURE_DISABLED", "Natural-language search is not configured on this RepoAtlas instance.");
  }
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 1 });
  let response;
  try {
    response = await client.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      // A short structured extraction: low effort keeps it fast.
      output_config: { effort: "low", format: betaZodOutputFormat(interpretation) },
      // On a safety-classifier decline the API re-runs the request on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      throw new AppError("UPSTREAM_RATE_LIMITED", "The AI service is busy. Try again shortly, or use the regular filters.", { cause: e });
    }
    if (e instanceof Anthropic.APIError) {
      log.warn("ai.interpret_failed", { status: e.status });
      throw new AppError("UPSTREAM_UNAVAILABLE", "The AI service could not interpret this request. Use the regular filters instead.", { cause: e });
    }
    throw e;
  }
  if (response.stop_reason === "refusal") {
    throw new AppError("INVALID_INPUT", "This request could not be interpreted as a repository search. Try rephrasing it.");
  }
  const parsed = response.parsed_output;
  if (!parsed) {
    throw new AppError("UPSTREAM_BAD_RESPONSE", "The AI service returned an unusable answer. Use the regular filters instead.");
  }
  // Re-validate: the SDK parses, but we never trust model output without our own schema.
  const checked = interpretation.parse(parsed);
  const { spec, dropped } = interpretationToSpec(checked);
  return { interpretation: checked, spec, dropped };
}
