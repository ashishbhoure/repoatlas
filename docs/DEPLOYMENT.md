# Deployment

RepoAtlas needs a Node.js runtime (Cache Components does not support the Edge runtime) and
PostgreSQL. Configuration is read at request time, so one build works in every environment.

## Vercel (or another Next.js host)

1. Create a PostgreSQL database (Neon, Supabase, RDS, …) and set `DATABASE_URL`.
2. Set `APP_URL` to the production URL, plus `GITHUB_TOKEN`, `AUTH_SECRET`, `GITHUB_CLIENT_ID`,
   `GITHUB_CLIENT_SECRET`, `CRON_SECRET` and (optionally) `ANTHROPIC_API_KEY`.
3. Update the GitHub OAuth App callback to `{APP_URL}/api/auth/callback/github`.
4. Run migrations on deploy: `pnpm db:deploy` (e.g. as a build step or a one-off job).
5. `vercel.json` schedules `/api/cron/snapshots` (every 6 h) and `/api/cron/alerts` (every 3 h).
   Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.

## Docker

```bash
docker build --target migrate -t repoatlas-migrate .
docker build -t repoatlas .
docker run --rm -e DATABASE_URL=… repoatlas-migrate
docker run -p 3000:3000 --env-file .env.production repoatlas
```

Or everything locally with Compose (PostgreSQL + migrations + app):

```bash
docker compose --profile app up --build
```

The runtime image uses Next.js `standalone` output, runs as a non-root user and has a health
check on `/api/health`. Schedule the cron endpoints with any scheduler, e.g.:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://repoatlas.example.com/api/cron/snapshots
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://repoatlas.example.com/api/cron/alerts
```

## Production checklist

- [ ] `APP_URL` is `https://…` (enables secure cookies, HSTS and `upgrade-insecure-requests`)
- [ ] `GITHUB_TOKEN` set (check `/status` for quota)
- [ ] Migrations applied with a DDL-capable role; app uses a DML-only role
- [ ] Cron jobs scheduled and returning 200
- [ ] Logs collected from stdout (JSON lines); `/api/health` monitored
- [ ] Behind a proxy that sets `X-Forwarded-For` (rate limiting)

## Scaling notes

The Postgres cache and rate-limit tables are shared, so horizontal scaling works without Redis.
If traffic grows enough that cache writes become a bottleneck, add a Redis `CacheStore`
implementation behind the same interface (`src/lib/cache/store.ts`).
