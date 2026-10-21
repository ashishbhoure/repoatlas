import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { env, features } from "@/config/env";
import { db } from "@/lib/database/prisma";

/**
 * Application authentication (who the RepoAtlas user is). This is separate from GitHub API
 * authorization: public-data requests always use the server's GITHUB_TOKEN, never the
 * user's OAuth token. OAuth requests only the default read:user and user:email scopes.
 */
function create() {
  const e = env();
  return betterAuth({
    appName: "RepoAtlas",
    baseURL: e.APP_URL,
    secret: e.AUTH_SECRET,
    database: prismaAdapter(db(), { provider: "postgresql" }),
    trustedOrigins: [e.APP_URL],
    socialProviders: {
      github: {
        clientId: e.GITHUB_CLIENT_ID ?? "",
        clientSecret: e.GITHUB_CLIENT_SECRET ?? "",
      },
    },
    account: {
      encryptOAuthTokens: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      useSecureCookies: e.APP_URL.startsWith("https://"),
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof create>;
const globalForAuth = globalThis as unknown as { repoAtlasAuth?: Auth };

/** The Better Auth instance, or null when authentication is not configured. */
export function getAuth(): Auth | null {
  if (!features.auth()) return null;
  globalForAuth.repoAtlasAuth ??= create();
  return globalForAuth.repoAtlasAuth;
}
