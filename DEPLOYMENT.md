# Vercel deployment

This is one server-rendered Next.js application. No separate API, worker, Redis, SQLite or background service is required.

## Configure

Import `Qeilvra/kitchen-eq-demo-software` into Vercel. Select Next.js, repository root, pnpm and Node.js 22 or newer.

- Install: `pnpm install --frozen-lockfile`
- Build: `pnpm build`
- Output: Next.js default; do not set static export.
- Runtime environment: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Optional: `APP_URL` for a canonical origin. Otherwise framework-relative navigation works for localhost, preview and production. Password authentication uses cookie sessions and relative redirects; it does not depend on a fixed deployment hostname.
- Do not deploy the DB connection string, service role key, reset confirmation or generated credentials file. These are bootstrap-only values.

## Supabase Auth configuration

In Supabase Authentication → URL configuration, set the production Site URL to the final Vercel HTTPS origin. Add `http://localhost:3000/**`, the production origin with `/**`, and the appropriate Vercel preview pattern for this project. No email-based or OAuth callbacks are used in this demo; the allowlist prepares the project for future Auth flows. Demo users are confirmed by the bootstrap script.

## Before presenting

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:live
pnpm exec playwright test
```

Apply migrations and seed before testing live login. Browser tests that need real demo accounts explicitly skip when `demo-credentials.local.json` is absent. A passing build alone does not confirm hosted database setup.

## Deploy from CLI

```sh
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Also configure preview/development scopes if used.
vercel --prod
```

Deployment requires a signed-in Vercel account and the two public environment variables. Keep project protection/login requirements in mind when sharing the client URL: the client must be able to reach the AIRMECH login page from another laptop.

Verify the final deployment returns Ready, open `/login` from a normal browser, log in with both office and engineer accounts, complete the scenario in DEMO.md, refresh the records and print a report. Record the URL and actual hosted test status in the handoff. Do not treat an unseeded login page as an accepted client demo.
