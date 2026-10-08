# Supabase setup

Dedicated demo project: `ejtjyxsumvtjtkurldax`. Base URL: `https://ejtjyxsumvtjtkurldax.supabase.co`. SDK configuration uses the project base URL, without `/rest/v1/`.

## Environment

| Variable                        | Where                    | Purpose                                                          |
| ------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Local and Vercel         | Supabase project base URL                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local and Vercel         | Browser-safe publishable key; `sb_publishable_…` is supported    |
| `SUPABASE_SERVICE_ROLE_KEY`     | Local bootstrap only     | Auth admin creation, scoped demo seed/reset and seed documents   |
| `SUPABASE_DB_URL`               | Local migrations only    | TLS PostgreSQL direct/session-pooler connection string           |
| `DEMO_PROJECT_REF`              | Local bootstrap          | Must equal `ejtjyxsumvtjtkurldax`                                |
| `DEMO_PASSWORD`                 | Optional local bootstrap | At least 14 characters; otherwise securely generated             |
| `DEMO_RESET_CONFIRM`            | Local reset only         | Must equal the dedicated project ref for explicit reset          |
| `APP_URL`                       | Optional local/Vercel    | Canonical application origin when needed; no fixed host required |

Never publish a service role key, DB password or connection string. Do not paste secrets into source, chat, `.env.example` or documentation. `.env`, `.env.local` and `demo-credentials.local.json` are excluded from Git.

## Schema

Run `pnpm db:migrate`. The migration creates tenants, roles/profiles and 25 business tables. Foreign keys include tenant ownership, preventing cross-tenant associations. Link validation checks the customer/site/asset and linked sales/service record relationships. Indexed foreign keys and tenant/status/date indexes support record navigation and lists.

The migration runner records checksums in `airmech_meta.migrations`; it rejects editing an already-applied migration. Use a new numbered migration for subsequent changes. If using the Supabase SQL editor to apply the SQL manually, do not then run the migration runner against those same untracked objects; choose one application method and record it.

## Demo accounts

Run `pnpm db:seed` with the administrative key. It creates confirmed password users directly with the Auth admin API. Email delivery, SMTP, registration, invitations, magic links and password-reset emails are unnecessary. Existing demo accounts are reused; another tenant's profiles are not overwritten. The generated password is saved to ignored `demo-credentials.local.json`, never printed or included in client bundles. Distribute it directly to the presenter.

## Storage

The migration creates private `airmech-documents`, limited to 10 MB per file, for JPEG, PNG, WebP, PDF and plain text. Seed records include commissioning checklists. New attachments upload through authenticated server actions. An engineer's object path and document metadata must reference one of their own jobs. Download route authorization checks document RLS and creates a 60-second signed URL.

## Roles and security

- Stored `profiles.role` governs access; user metadata and submitted role claims are not trusted.
- All tables use RLS. Public/anonymous callers cannot read business records.
- Sales/Admin has commercial/customer access. Service Manager has service/customer access. Management has office access. Super Admin has full access.
- Engineers can read only assigned jobs, linked customer/site/asset/complaint records and their reports. Commercial tables return no rows.
- Direct work-order mutations and report creation are blocked by RLS; validated transactional functions perform those actions.
- Private attachment access follows document RLS. Profile roles cannot be self-edited.
- Atomic SQL functions validate caller permissions, tenant scope and allowed state transitions; completion requires diagnosis, work performed and customer confirmation.

## Safe reset

```sh
# Set DEMO_RESET_CONFIRM=ejtjyxsumvtjtkurldax in .env.local first.
pnpm db:reset-demo
```

The script prints the project and tenant before resetting. It requires a matching target project, confirmation marker and administrative API key. The server-side `am_reset_demo` function accepts only service-role access or the dedicated tenant's Super Admin. It deletes only records with the fixed demo tenant ID `a1000000-0000-4000-8000-000000000001`; it preserves other tenants and Auth users/profiles. It then recreates the full dataset. Re-running `db:seed` without reset inserts missing seed rows and preserves changes to existing records.

Reset is deliberately a presenter-operated command, rather than a destructive browser control. Run it before a presentation, never while someone is actively demonstrating. A partial seed failure can be retried. `pnpm test:live` verifies hosted demo login, data and engineer RLS without changing records.
