# AIRMECH ONE

A fresh, single-application HVAC / MEP client demonstration. Built by Qeilvra. Next.js App Router, React, strict TypeScript, Supabase PostgreSQL/Auth/private Storage and pnpm. Designed for Vercel.

## Run locally

Use Node.js 22 or newer and pnpm 10.18.3.

```sh
pnpm install
cp .env.example .env.local
# Fill the public Supabase URL/key and administrative bootstrap values.
pnpm db:migrate
pnpm db:seed
pnpm dev
```

On Windows, use `Copy-Item .env.example .env.local` and `pnpm.cmd` if PowerShell blocks pnpm scripts. The application opens at http://localhost:3000 and redirects to login.

## Architecture

One Next.js application. Server components read through a cookie-authenticated Supabase client. Server actions validate input and stored role permissions. PostgreSQL RLS additionally restricts direct API access. Engineer data is constrained to the engineer's assigned work orders and linked records. Transactional PostgreSQL functions implement quotation conversion, dispatch, job state changes, report generation and PM completion. No alternate local-data backend or mock-login bypass exists.

Every business table has typed relational columns, tenant ownership, references and indexes. Forms share a typed module catalog; the database remains normalized. Dashboard aggregates and reports read the database. Documents use a private bucket and short-lived signed URLs. The administrative key is used only by local bootstrap scripts, never by application UI or ordinary requests.

## Modules

Dashboard, customers and Customer 360, contacts, sites, enquiries and notes, quotations and items/follow-ups/revisions, projects and teams, equipment/warranty/history, complaints and classification overrides, engineers, dispatch, work orders, engineer field home, readings, parts, service reports, AMC coverage, PM schedules/visits, private documents, in-app notifications, global search, reports/CSV, account/workspace and demonstration guide.

## Commands

| Command                             | Purpose                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| `pnpm dev`                          | Development server                                                    |
| `pnpm format` / `pnpm format:check` | Format / verify formatting                                            |
| `pnpm lint`                         | ESLint                                                                |
| `pnpm typecheck`                    | Strict TypeScript                                                     |
| `pnpm test`                         | Business rules and real PostgreSQL workflow/RLS tests                 |
| `pnpm exec playwright test`         | Desktop/mobile browser checks; live checks require seeded credentials |
| `pnpm build` / `pnpm start`         | Production build / serve                                              |
| `pnpm db:migrate`                   | Apply versioned migrations transactionally                            |
| `pnpm db:seed`                      | Confirm users and insert missing deterministic demo records           |
| `pnpm db:reset-demo`                | Explicit reset of the dedicated demo tenant, then reseed              |
| `pnpm test:live`                    | Read-only hosted Auth/RLS/data validation                             |

Tests use PGlite, an embedded PostgreSQL engine, only as a development test fixture. The running application uses hosted Supabase exclusively. The test fixture supplies the Supabase `auth`/`storage` schemas and tests the application SQL and RLS; actual hosted Auth and signed-storage behavior still require `test:live` and a browser walkthrough.

## Structure

```text
src/app/                 Routes, server actions, office/field shells
src/components/          Dashboard, record forms, tables/cards, workflow controls
src/lib/                 Auth, typed metadata, data access and business rules
supabase/migrations/     Versioned relational schema, RLS, workflows and storage policies
scripts/                Migration, deterministic seed, environment setup, live verification
tests/                  Business rules, relational consistency, PostgreSQL workflow/security
e2e/                    Desktop and mobile browser smoke checks
```

See [SUPABASE.md](SUPABASE.md), [DEPLOYMENT.md](DEPLOYMENT.md) and [DEMO.md](DEMO.md). Secrets and generated login credentials are gitignored.
