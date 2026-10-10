# Finance closeout verification

Verified on 11 October 2026 (Asia/Karachi) against the dedicated AIRMECH hosted Supabase project and the local production application build. Finance scope remains invoices, payments, receivables, project profitability, AMC billing, dashboards and the existing reports.

| Requested check | Result |
| --- | --- |
| Paid Service Revenue | Changed from service invoice face values to actual recorded payment amounts. A 1,000 OMR invoice contributes 400 OMR after a 400 OMR payment and 1,000 OMR after the final 600 OMR payment. |
| Source linkage | Uses `source_type`, `invoice_id`, `project_id`, `amc_id`, `work_order_id` and relational service classification. No description-text matching. Composite foreign keys enforce tenant/source ownership. Issued invoice source types are locked. |
| Hosted migrations | Migrations 001–008 applied in order; every stored checksum matches its local migration file. Local/hosted tables, columns, foreign keys/checks, indexes, views, functions, triggers, policies and table grants match. |
| Live Supabase | Authenticated API checks passed for invoice/item creation, totals, partial/final/multiple payments, balances, paid/overdue states, reversal, cancellation, retry idempotency, overpayment prevention, receivables, owner aggregates, service collections, project summary and AMC summary. Disposable business records and their audit entries are removed. |
| Browser finance acceptance | Four desktop and four mobile finance tests passed: Accounts invoice/item creation and partial/final payments, Owner dashboard/quotations/project financials/invoices/receivables/eight reports/CSV, Management permitted reads, and Engineer denials. No browser runtime errors. Two existing desktop login/workspace smoke tests also passed. |
| Authorization | Owner/Director and Management read permitted finance data; Accounts records invoices/payments; Engineer direct table reads return no finance rows, finance RPCs reject access, browser finance routes render the not-found page, company dashboard redirects to Field, and finance export returns 403. Managed-project finance grants are covered by database tests. |
| Performance | Report totals/groups now aggregate in PostgreSQL across all matching records; normal page payload is 20 rows. Register/export queries cap batches at 500; report RPC caps at 100. Independent register/filter/overview reads run concurrently. Invoice and payment dashboard aggregates run once, with grouped month/aging results. Project/AMC views combine repeated invoice aggregates. No application query per invoice/payment row was found. |
| Final automated checks | Full local suite: 15 passing tests; finance subset: 3 passing tests. Eight finance browser tests and two existing desktop smoke tests passed. Lint, strict TypeScript check and production build passed. |
| Remaining blockers | No remaining finance verification blockers. The verified frontend is the local production build; the hosted frontend was not redeployed. |

The fix is in migrations `007_finance_closeout.sql` and `008_finance_grant_alignment.sql`, the shared report definitions/filters, financial report RPC, report page and CSV export. `paid_service_collections` is a PostgreSQL view with `security_invoker=true`, preserving invoice/payment row-level restrictions. It includes only recorded payments against issued, non-cancelled Service invoices originating from Paid Service work, plus explicitly authorized chargeable warranty extras. It excludes AMC contract invoices, covered AMC service unless reclassified as Paid Service, unchargeable warranty work, unpaid balances, drafts, cancellations and reversals. Payments use their actual receipt date. PostgreSQL numeric calculations and locked invoice rows remain authoritative for balances and overpayment prevention.

Eight required reports are covered by amount assertions: Outstanding Receivables, Payment History, Receivables Aging, Project Financial Summary, Project Profitability, AMC Contract Value, Paid Service Revenue and Customer Financial History. The owner browser check also downloads and verifies the collected-payment CSV. Project profit remains recognized revenue minus actual recorded/overridden cost; contract value is not recognized revenue.

The hosted schema comparison covers 45 relations, 627 columns, 323 constraints, 241 indexes, four views, 75 functions, 99 triggers, 82 policies and 299 table grants. PostgreSQL's version-dependent representation of NOT NULL constraints is normalized; column nullability is independently compared. Supabase's inherited REFERENCES/TRIGGER/TRUNCATE grants were removed where the migrations do not grant them.

Read-only hosted execution timings on the existing demo dataset were approximately 97 ms for the dashboard, 14 ms for Paid Service Revenue, 7 ms for receivables aging and 23 ms for project summary. These are database timings, not browser latency or a production load benchmark. Query plans are saved locally. Browser verification also identified and fixed SVG chart title hydration errors and missing outstanding balances in mobile invoice cards.

Browser acceptance uses headless Chrome with desktop and mobile viewports against `pnpm start --port 3100`, backed by hosted Supabase. Next.js may retain HTTP 200 after streaming a not-found response; denial tests assert the rendered 404 screen and absence of financial metrics. Finance exports explicitly return HTTP 403. Frontend deployment is outside this verification: the existing hosted frontend was not redeployed.

Reusable commands:

```powershell
pnpm.cmd test
pnpm.cmd test:finance
pnpm.cmd db:verify-finance
pnpm.cmd test:finance:live
pnpm.cmd test:finance:performance
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
# Run pnpm.cmd start --port 3100 in another terminal, then:
$env:TEST_BASE_URL = 'http://localhost:3100'
$env:PLAYWRIGHT_CHANNEL = 'chrome'
pnpm.cmd test:finance:browser
```

Live scripts require the configured dedicated demo project, verified database TLS, and existing ignored demo credentials. Verification results, query plans, browser screenshots and schema comparisons are stored in the ignored `artifacts/finance-closeout/` directory. The Windows sandbox can prevent `tsx` from reading the user profile; the affected checks passed when run through the authorized execution path.
