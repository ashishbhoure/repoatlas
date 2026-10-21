import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Only DATABASE_URL and APP_URL are required; every other
 * integration is optional and reports itself as disabled when its variables are missing.
 * Nothing here is ever exposed to the browser (no NEXT_PUBLIC_ prefix).
 */
const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  GITHUB_TOKEN: optional,
  AUTH_SECRET: optional.refine((v) => v === undefined || v.length >= 32, {
    message: "AUTH_SECRET must be at least 32 characters",
  }),
  GITHUB_CLIENT_ID: optional,
  GITHUB_CLIENT_SECRET: optional,
  CRON_SECRET: optional,
  ANTHROPIC_API_KEY: optional,
  /** Overrides the GitHub API base URL. Only used by tests (mock server). */
  GITHUB_API_URL: z.string().url().default("https://api.github.com"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

const has = (name: string) => Boolean(process.env[name]?.trim());

/**
 * Which optional integrations are configured. Reads process.env directly (no full schema
 * parse) so it is safe during build-time prerendering where DATABASE_URL may be absent.
 */
export const features = {
  githubToken: () => has("GITHUB_TOKEN"),
  auth: () => has("AUTH_SECRET") && has("GITHUB_CLIENT_ID") && has("GITHUB_CLIENT_SECRET"),
  cron: () => has("CRON_SECRET"),
  aiSearch: () => has("ANTHROPIC_API_KEY"),
};
