import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { financeDatabase } from "./finance-db";
import { DEMO_TENANT } from "./demo-data";

const db=await financeDatabase();
try {
  const profile=(await db.query("select id from public.profiles where tenant_id=$1 and role='owner_director' limit 1",[DEMO_TENANT])).rows[0];
  assert.ok(profile,"Owner demo account required.");
  await db.query("begin");
  await db.query("select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',$1,true)",[profile.id]);
  await db.query("set local role authenticated");
  const timings:Record<string,number>={};
  for(const [name,sql,params] of [
    ["dashboard","select public.am_financial_overview()",[]],
    ["paidServiceReport","select public.am_financial_report('paid-service-revenue',null,1,20)",[]],
    ["receivablesAging","select public.am_financial_report('receivables-aging',null,1,20)",[]],
    ["projectSummary","select public.am_finance_read('project_financial_summary','{}',1,20)",[]],
  ] as [string,string,unknown[]][]) {
    const plan=(await db.query(`explain(analyze,format json) ${sql}`,params)).rows[0]["QUERY PLAN"][0];
    timings[name]=plan["Execution Time"];
  }
  const report=(await db.query("select public.am_financial_report('payment-history',null,1,10000) data")).rows[0].data;
  const register=(await db.query("select public.am_finance_read('payments','{}',1,10000) data")).rows[0].data;
  assert.ok(report.records.length<=100);assert.ok(register.records.length<=500);
  const plans:Record<string,unknown>={};
  for(const [name,sql] of [
    ["collectedService","select id,amount from public.paid_service_collections order by created_at desc,id limit 20"],
    ["receivables","select id,balance,aging_bucket from public.receivables order by created_at desc,id limit 20"],
    ["projectRollup","select project_id,invoiced_amount,paid_amount,outstanding_amount from public.project_financial_summary limit 20"],
  ]) plans[name]=(await db.query(`explain(analyze,buffers,format json) ${sql}`)).rows[0]["QUERY PLAN"];
  await db.query("rollback");
  await mkdir("artifacts/finance-closeout",{recursive:true});
  await writeFile("artifacts/finance-closeout/performance.json",JSON.stringify({timingsMs:timings,limits:{report:100,register:500,normalReportPage:20},plans},null,2));
  console.log("Hosted database execution times (ms):",JSON.stringify(timings));
  console.log("Verified server bounds: report ≤100, register/export batch ≤500; normal report page 20. Plans saved.");
}catch(error){await db.query("rollback");throw error;}finally{await db.end();}
