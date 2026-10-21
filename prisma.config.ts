import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js reads .env.local; load it first so the CLI and the app target the same database.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
