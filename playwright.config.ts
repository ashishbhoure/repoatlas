import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH_SECRET, E2E_PORT } from "./tests/e2e/constants";

/**
 * End-to-end tests run a production build against a mock GitHub API (tests/e2e/mock-github.mjs)
 * and the dedicated test database, so they are deterministic and use no live API quota.
 */
const PORT = E2E_PORT;
const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://repoatlas:repoatlas@localhost:5433/repoatlas_test";

const appEnv = {
  DATABASE_URL: TEST_DB,
  APP_URL: `http://localhost:${PORT}`,
  GITHUB_API_URL: "http://localhost:4010",
  GITHUB_TOKEN: "",
  AUTH_SECRET: E2E_AUTH_SECRET,
  GITHUB_CLIENT_ID: "e2e-client-id",
  GITHUB_CLIENT_SECRET: "e2e-client-secret",
  CRON_SECRET: "e2e-cron-secret",
  ANTHROPIC_API_KEY: "",
};

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: "**/mobile.spec.ts" },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: "**/mobile.spec.ts" },
  ],
  webServer: [
    {
      command: "node tests/e2e/mock-github.mjs",
      port: 4010,
      reuseExistingServer: false,
    },
    {
      command: `pnpm exec next start --port ${PORT}`,
      port: PORT,
      timeout: 120_000,
      reuseExistingServer: false,
      env: appEnv,
    },
  ],
});
