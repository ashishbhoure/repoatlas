import { z } from "zod";

/**
 * Zod schemas for the subset of GitHub REST responses RepoAtlas uses. Unknown keys are
 * stripped, so only the fields we need are cached. A response that does not match is
 * treated as an upstream error instead of being rendered.
 */

const nullableString = z.string().nullable().optional().transform((v) => v ?? null);

export const ghOwner = z.object({
  login: z.string(),
  avatar_url: nullableString,
  type: z.string().nullable().optional(),
  html_url: nullableString,
});

export const ghLicense = z
  .object({
    key: z.string(),
    name: z.string(),
    spdx_id: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const ghRepository = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: ghOwner,
  html_url: z.string().url(),
  description: nullableString,
  homepage: nullableString,
  language: nullableString,
  topics: z.array(z.string()).optional().default([]),
  stargazers_count: z.number().int().nonnegative(),
  forks_count: z.number().int().nonnegative(),
  open_issues_count: z.number().int().nonnegative(),
  license: ghLicense,
  archived: z.boolean().default(false),
  fork: z.boolean().default(false),
  is_template: z.boolean().optional().default(false),
  default_branch: z.string().default("main"),
  size: z.number().int().nonnegative().default(0),
  created_at: z.string(),
  updated_at: z.string(),
  pushed_at: nullableString,
  visibility: z.string().optional(),
  // Present on the single-repository endpoint only.
  subscribers_count: z.number().int().optional(),
  network_count: z.number().int().optional(),
  has_issues: z.boolean().optional(),
  has_wiki: z.boolean().optional(),
  has_discussions: z.boolean().optional(),
});
export type GhRepository = z.infer<typeof ghRepository>;

export const ghSearchResponse = z.object({
  total_count: z.number().int().nonnegative(),
  incomplete_results: z.boolean(),
  items: z.array(ghRepository),
});

export const ghRelease = z.object({
  tag_name: z.string(),
  name: nullableString,
  html_url: z.string().url(),
  published_at: nullableString,
  prerelease: z.boolean().default(false),
  draft: z.boolean().default(false),
});

export const ghContributors = z.array(
  z.object({
    login: z.string().optional(),
    avatar_url: nullableString,
    html_url: nullableString,
    contributions: z.number().int().nonnegative(),
    type: z.string().optional(),
  }),
);

const ghFile = z.object({}).passthrough().nullable().optional();

export const ghCommunityProfile = z.object({
  health_percentage: z.number().nullable().optional(),
  description: nullableString,
  files: z
    .object({
      readme: ghFile,
      license: ghFile,
      contributing: ghFile,
      code_of_conduct: ghFile,
      code_of_conduct_file: ghFile,
      issue_template: ghFile,
      pull_request_template: ghFile,
    })
    .partial()
    .default({}),
});

export const ghLanguages = z.record(z.string(), z.number().int().nonnegative());

export const ghCommitActivity = z.array(
  z.object({
    week: z.number().int(),
    total: z.number().int().nonnegative(),
  }),
);

export const ghTopicSearch = z.object({
  total_count: z.number().int(),
  items: z.array(
    z.object({
      name: z.string(),
      display_name: nullableString,
      short_description: nullableString,
      description: nullableString,
      featured: z.boolean().optional(),
      curated: z.boolean().optional(),
    }),
  ),
});

export const ghRateLimit = z.object({
  resources: z.record(
    z.string(),
    z.object({ limit: z.number(), remaining: z.number(), reset: z.number(), used: z.number() }),
  ),
});
