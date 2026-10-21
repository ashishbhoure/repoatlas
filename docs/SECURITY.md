# Security

## Controls in place

| Area | Implementation |
| --- | --- |
| Secrets | Server-only env vars validated in `src/config/env.ts`; no `NEXT_PUBLIC_` secrets; `.env*` git-ignored except `.env.example` |
| GitHub access | Server `GITHUB_TOKEN` for public data only; users' OAuth tokens are encrypted at rest and never used for API calls |
| OAuth | Better Auth (state/PKCE handled by the library); scopes `read:user user:email`; trusted origin = `APP_URL`; secure cookies on HTTPS |
| Sessions | HttpOnly, SameSite=Lax cookies, 30-day expiry with daily refresh |
| CSRF | Every cookie-authenticated mutation requires a same-origin `Origin`/`Referer` (`assertSameOrigin`) |
| Authorization | Ownership enforced in the service layer — every query on user data is scoped by `userId`; foreign ids return 404 |
| Input validation | Zod for URL params, bodies, route params; owner/name and ids are pattern-checked before reaching GitHub (path traversal blocked) |
| Injection | Prisma parameterized queries; the only raw SQL uses tagged templates (`$queryRaw`) with bound values |
| XSS | README HTML sanitized with an allow-list (`sanitize-html`): no scripts, styles, event handlers, iframes, SVG, forms, `javascript:`/`data:` URLs; ids namespaced (`user-content-`) against DOM clobbering; relative links resolved to github.com. React escapes all other external text |
| Search-syntax injection | AI output is reduced to fixed fields; keywords containing qualifier characters are dropped |
| Open redirects | `?next=` accepts only same-origin relative paths (`safeNextPath`) |
| SSRF | No endpoint fetches user-supplied URLs; the GitHub base URL is fixed by configuration |
| Rate limiting | Postgres-backed fixed windows for search, suggestions, repository, mutation and AI endpoints; cron endpoints require a bearer secret compared in constant time |
| Headers | CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `connect-src 'self'`, images only from GitHub CDNs), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP; HSTS + `upgrade-insecure-requests` on HTTPS |
| Error handling | Safe messages only; stack traces and upstream details stay in server logs |
| Logging | Structured JSON; keys matching token/secret/password/authorization/cookie/api-key are redacted |
| Containers | Runtime image runs as a non-root user; secrets are injected at runtime, not baked into the image |

## Checklist (re-run before releases)

- [x] `pnpm audit --prod` — no known vulnerabilities (2026-10-22)
- [x] Secrets absent from the repository and the client bundle
- [x] Every `/api` mutation passes `userForMutation` (auth + same-origin + rate limit)
- [x] Ownership tests: `tests/integration/library.test.ts`, `tests/integration/alerts.test.ts`
- [x] Sanitizer tests: `tests/unit/sanitize-readme.test.ts`; e2e checks the rendered README
- [x] Open-redirect tests: `tests/unit/features.test.ts`
- [x] Cross-origin and anonymous mutation rejected (e2e `library.spec.ts`)

## Remaining risks and notes

- **CSP allows `'unsafe-inline'` scripts.** Next.js bootstrap scripts and the theme script are
  inline, and pages use Partial Prerendering, which rules out per-request nonces without making
  every page dynamic. Other directives limit the impact; README HTML is sanitized independently.
- **Development-only advisories.** `pnpm audit` (all deps) reports advisories in `lodash` (via
  Prisma Studio) and `braces` (via the shadcn CLI). Neither ships in the production bundle.
- **Shared collection links** are unguessable (72-bit random) but public to anyone who has them.
- **IP-based rate limits** trust the first `X-Forwarded-For` hop; deploy behind a proxy that sets
  it (Vercel, a load balancer) or the limits apply per proxy.
- **README images** load from GitHub's image proxy (camo) or raw.githubusercontent.com, so the
  viewer's IP is visible to GitHub, as on github.com.
- **AI search** sends the user's text to Anthropic; nothing else is sent.
