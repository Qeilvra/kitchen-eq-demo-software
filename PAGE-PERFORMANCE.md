# Page performance investigation — 11 October 2026

The deployed delay was reproduced at https://airmech-one.vercel.app. The common
cost is waiting for server-side data across US East-to-Tokyo round trips,
compounded by sequential Supabase requests. The quotation report also contained
an N+1 read. The approved Tokyo preview reduced measured page load times by
44–64%. The production measurements below are from the unchanged control
deployment at the time of the benchmark.

## Evidence

- `vercel inspect` confirmed the production functions run in `iad1` (US East).
- DNS for the configured database resolved to an IPv6 address inside AWS's
  `2406:da14::/35` EC2 range, identified by AWS's published IP ranges as
  `ap-northeast-1` (Tokyo). This identifies the database region from its address;
  no database or account configuration was changed during investigation.
- On deployed pages, completing the server response took 1.70–3.46 seconds on
  average, accounting for most of the 1.83–3.64 seconds to display page content.
- Local production-server traces against the same live database showed auth,
  profile, records and related-label reads running in consecutive waves.
  Individual ordinary backend requests typically took 180–300ms locally.
- The quotation report fetched a raw page, related labels, then made 20 separate
  `am_finance_read` RPCs for quotation totals: 27 backend requests in total.
  The slowest observed baseline backend request was one of these RPCs at 709ms.
  This is a measured local production-server HTTP duration, not a hosted SQL time.
- Read-only `EXPLAIN ANALYZE` under authenticated admin RLS showed 0.634ms for the
  profile query, 5.764ms for customers, 6.613ms for complaints, 24.053ms for a
  quotation page, 9.817ms for one quotation, 90.778ms for the financial dashboard
  and 107.260ms for customer metrics. These are database execution times only.

## Hosted before/after comparison

The unchanged production control was remeasured immediately before the preview,
using the same machine, Chrome browser, network and authenticated admin account.
Two full loads per route on production and three on preview; background route
prefetching disabled to isolate each request. Values are averages, in seconds.

| Page | Production content ready | Preview content ready | Production server response | Preview server response |
| --- | ---: | ---: | ---: | ---: |
| Dashboard | 2.933 | 1.558 | 2.725 | 1.120 |
| Customers | 2.614 | 1.384 | 2.306 | 0.810 |
| Enquiries | 4.067 | 1.467 | 3.789 | 0.878 |
| Quotations | 2.870 | 1.323 | 2.580 | 0.844 |
| Service Desk | 3.660 | 1.466 | 3.499 | 0.983 |
| Assets | 3.483 | 1.360 | 3.338 | 0.943 |
| Invoices | 2.224 | 1.253 | 1.981 | 0.879 |
| Commercial Pipeline report | 3.103 | 1.321 | 2.871 | 0.847 |

Preview: https://airmech-9jub4dcb6-dawoodtahir061-2755.vercel.app
Deployment: `dpl_H4ubjws3LcGERXerTRqQefshbrpt`. Vercel inspection confirmed
functions run in `hnd1`; responses also identify `hnd1`. Platform Deployment
Protection remains enabled, and the browser still signs into the app normally.

The report was sampled through `?report=quotations`, which falls back to the
existing default Commercial Pipeline report; its actual navigation key is
`pipeline`, which was separately checked for correct report rendering. These
figures describe those full document loads, not cached
client-side transitions, cold-start guarantees or all possible roles/data sizes.

## Changes applied to source

1. Configure Vercel functions for `hnd1` (Tokyo), colocating compute with the
   database. This is deployed and verified in the approved preview.
2. Read quotation-report rows and persisted totals together through the existing
   authorized finance reader, removing 20 per-row RPCs. Pagination and amounts
   remain based on the existing database reader.
3. Load independent maintenance/service summaries alongside record reads; load
   engineer labels and asset/quotation presentation alongside related labels.
4. Reuse already-loaded finance filter/customer lookups for record labels. Fetch
   any missing IDs separately so the 200-option filter limit does not hide labels.

Auth `getUser`, request-scoped profile caching, permission checks, tenant RLS,
workflow writes and financial calculations are retained. No cross-user cache was
introduced and no database migrations were needed.

## Local production-build comparison

Same machine, same live database, three full loads per route. Median content-ready
time in seconds. The region configuration cannot be exercised by localhost.

| Page | Before | After | Backend requests before → after |
| --- | ---: | ---: | ---: |
| Dashboard | 1.195 | 1.420 | 8 → 8 |
| Customers | 1.569 | 1.435 | 4 → 4 |
| Enquiries | 1.513 | 1.697 | 7 → 7 |
| Quotations | 1.410 | 1.624 | 7 → 7 |
| Service Desk | 1.975 | 2.034 | 13 → 13 |
| Assets | 1.806 | 1.365 | 8 → 8 |
| Invoices | 1.214 | 1.241 | 10 → 7 |
| Commercial Pipeline report | 1.952 | 1.539 | 27 → 7 |

The request reductions are verified. Local samples alone do not show an overall
improvement on every page because network variation affects these short runs
and localhost cannot exercise the deployment-region fix. The hosted comparison
above verifies improvement across all eight sampled routes after the combined
region and code changes; it does not isolate each change's individual contribution.

## Other requested checks

- **Duplicate reads:** finance filter/record-label reads reused; auth/profile
  verification is already memoized per server render. Related salesperson profile
  lookups have different selectors and are not duplicate session checks.
- **N+1:** eliminated for quotation report totals; related labels and customer
  metrics already use bulk requests rather than one HTTP request per record.
- **Payloads:** sampled deployed documents were about 14–20 KiB compressed;
  loaded scripts about 145–153 KiB. Payload size did not account for the seconds
  spent awaiting server data.
- **Rendering/charts/images:** pages fetch data in Server Components. Financial
  charts use server-rendered SVG/CSS. Sampled images were zero or a 230-byte
  favicon; observed browser long tasks were at most 104ms.
- **Auth:** preserved live user verification. Baseline local auth+profile usually
  consumed roughly 0.4–0.5 seconds of sequential network time, despite the profile
  SQL executing in under 1ms.
- **Revalidation:** broad `revalidatePath('/', 'layout')` calls occur after actions,
  not ordinary reads. They do not explain the measured normal page-opening delay;
  retained to preserve connected financial/workflow updates.

## Verification

The repository's 15 tests passed, including financial integrity and role/RLS
boundaries. Both browser tests passed: unauthenticated redirects, connected office
modules and engineer restrictions. TypeScript, changed-file ESLint and a production build passed.
Hosted preview checks also passed: unauthenticated workspace redirects, engineer
sign-in and commercial access denial, the actual Commercial Pipeline navigation
route with visible quotation amounts, and invoices/payments/receivables rendering.
Temporary fetch instrumentation was removed from application source after tracing.
Raw measurements and SQL plans are in `artifacts/page-performance/` (git-ignored).

The approved private-source preview upload completed successfully. All hosted
after-fix measurements above were taken on that preview before pushing these
changes to `main`; the production control stayed unchanged throughout the benchmark.

References: [Vercel function region configuration](https://vercel.com/docs/functions/configuring-functions/region),
[Vercel region identifiers](https://vercel.com/docs/regions),
[AWS published IP ranges](https://ip-ranges.amazonaws.com/ip-ranges.json).
