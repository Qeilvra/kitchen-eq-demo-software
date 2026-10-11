import { mkdir, writeFile } from "node:fs/promises";
import { financeDatabase } from "./finance-db";
import { DEMO_TENANT } from "./demo-data";

const db = await financeDatabase();
try {
  const { rows: profiles } = await db.query(
    "select id from public.profiles where tenant_id=$1 and role='super_admin' limit 1",
    [DEMO_TENANT],
  );
  if (!profiles[0]) throw new Error("Dedicated demo admin is required.");
  await db.query("begin read only");
  await db.query(
    "select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',$1,true)",
    [profiles[0].id],
  );
  await db.query("set local role authenticated");
  const statements = {
    profile: "select id,tenant_id,full_name,role from public.profiles where id=auth.uid()",
    customers: "select id,name,code from public.customers order by created_at desc limit 20",
    customerMetrics:
      "select * from public.am_customer_metrics(array(select id from public.customers order by created_at desc limit 20))",
    complaints:
      "select id,name,code,status from public.complaints order by created_at desc limit 20",
    quotationsPage: "select public.am_finance_read('quotations','{}',1,20)",
    quotationSingle:
      "select public.am_finance_read('quotations','{}',1,20,(select id from public.quotations order by created_at desc limit 1))",
    dashboard: "select public.am_financial_overview()",
    invoices: "select public.am_finance_read('invoices','{}',1,20)",
  };
  const results: Record<string, { executionMs: number; planningMs: number; plan: unknown }> = {};
  for (const [name, sql] of Object.entries(statements)) {
    const plan = (await db.query(`explain (analyze,buffers,format json) ${sql}`)).rows[0][
      "QUERY PLAN"
    ][0];
    results[name] = {
      executionMs: plan["Execution Time"],
      planningMs: plan["Planning Time"],
      plan: plan.Plan,
    };
    console.log(`${name}: ${plan["Execution Time"]}ms SQL execution`);
  }
  await db.query("rollback");
  await mkdir("artifacts/page-performance", { recursive: true });
  await writeFile("artifacts/page-performance/database.json", JSON.stringify(results, null, 2));
} finally {
  await db.query("rollback");
  await db.end();
}
