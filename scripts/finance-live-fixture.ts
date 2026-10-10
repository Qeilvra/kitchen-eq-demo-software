import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { financeDatabase } from "./finance-db";
import { DEMO_TENANT, accounts } from "./demo-data";

export type FinanceLiveFixture = {
  customer: string; site: string; project: string; amc: string; equipment: string;
  work: string; warrantyWork: string; coveredWork: string; label: string; today: string; future: string; past: string;
};

export async function financeLogin(role: string): Promise<SupabaseClient> {
  const account = accounts.find(a => a.role === role);
  if (!account) throw new Error("Unknown verification role.");
  const { password } = JSON.parse(await readFile("demo-credentials.local.json", "utf8")) as {password:string};
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {auth:{persistSession:false,autoRefreshToken:false}});
  const { error } = await db.auth.signInWithPassword({email:account.email,password});
  if (error) throw new Error(`Hosted login failed for ${role}: ${error.message}`);
  return db;
}

export async function createFinanceLiveFixture(): Promise<FinanceLiveFixture> {
  const db = await financeDatabase();
  const fixture: FinanceLiveFixture = {
    customer:randomUUID(),site:randomUUID(),project:randomUUID(),amc:randomUUID(),equipment:randomUUID(),
    work:randomUUID(),warrantyWork:randomUUID(),coveredWork:randomUUID(),label:`Finance closeout ${randomUUID().slice(0,8)}`,
    today:"",future:"",past:"",
  };
  try {
    await db.query("begin");
    const profile = (await db.query("select id from public.profiles where tenant_id=$1 and role='super_admin' limit 1",[DEMO_TENANT])).rows[0];
    if (!profile) throw new Error("Dedicated demo administrator is missing.");
    await db.query("select set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub',$1,true)",[profile.id]);
    const dates = (await db.query("select public.am_today()::text today,(public.am_today()+30)::text future,(public.am_today()-120)::text past")).rows[0];
    Object.assign(fixture,dates);
    await db.query("insert into public.customers(id,tenant_id,name) values($1,$2,$3)",[fixture.customer,DEMO_TENANT,fixture.label]);
    await db.query("insert into public.sites(id,tenant_id,name,customer_id,location) values($1,$2,$3,$4,'Muscat')",[fixture.site,DEMO_TENANT,fixture.label,fixture.customer]);
    await db.query("insert into public.projects(id,tenant_id,name,customer_id,site_id,status) values($1,$2,$3,$4,$5,'Active')",[fixture.project,DEMO_TENANT,fixture.label,fixture.customer,fixture.site]);
    await db.query("update public.project_financials set base_value=2000,recognized_revenue=1000,actual_cost_override=250 where project_id=$1",[fixture.project]);
    await db.query("insert into public.amc_contracts(id,tenant_id,name,customer_id,site_id,start_date,end_date) values($1,$2,$3,$4,$5,$6,$7)",[fixture.amc,DEMO_TENANT,fixture.label,fixture.customer,fixture.site,fixture.today,fixture.future]);
    await db.query("update public.amc_financials set contract_value=3000 where amc_id=$1",[fixture.amc]);
    for (const [index,work] of [fixture.work,fixture.warrantyWork,fixture.coveredWork].entries()) {
      const equipment=index===0?fixture.equipment:randomUUID(),complaint=randomUUID();
      await db.query("insert into public.equipment(id,tenant_id,name,customer_id,site_id,amc_id,warranty_start,warranty_end) values($1,$2,$3,$4,$5,$6,$7,$8)",[
        equipment,DEMO_TENANT,fixture.label,fixture.customer,fixture.site,index===2?fixture.amc:null,index===1?fixture.today:null,index===1?fixture.future:null]);
      await db.query("insert into public.complaints(id,tenant_id,name,customer_id,site_id,equipment_id,problem) values($1,$2,$3,$4,$5,$6,'Controlled finance verification')",[complaint,DEMO_TENANT,fixture.label,fixture.customer,fixture.site,equipment]);
      await db.query("insert into public.work_orders(id,tenant_id,name,customer_id,site_id,equipment_id,complaint_id) values($1,$2,$3,$4,$5,$6,$7)",[work,DEMO_TENANT,fixture.label,fixture.customer,fixture.site,equipment,complaint]);
    }
    await db.query("commit");
    return fixture;
  } catch(error) {await db.query("rollback");throw error;} finally {await db.end();}
}

// Delete only the unique customer tree and test-only audit entries created by
// this verifier. Monetary counters deliberately remain monotonic.
export async function cleanupFinanceLiveFixture(fixture: Pick<FinanceLiveFixture,"customer"|"label">) {
  const db=await financeDatabase();
  try {
    await db.query("begin");
    const {rows}=await db.query("select name from public.customers where id=$1 and tenant_id=$2 for update",[fixture.customer,DEMO_TENANT]);
    if (!rows.length) {await db.query("commit");return;}
    if (rows[0].name!==fixture.label||!fixture.label.startsWith("Finance closeout ")) throw new Error("Disposable fixture identity mismatch; cleanup refused.");
    const profile=(await db.query("select id from public.profiles where tenant_id=$1 and role='super_admin' limit 1",[DEMO_TENANT])).rows[0];
    await db.query("select set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub',$1,true)",[profile.id]);
    const invoiceIds=(await db.query<{id:string}>("select id from public.invoices where customer_id=$1 and tenant_id=$2",[fixture.customer,DEMO_TENANT])).rows.map(r=>r.id);
    // Draft protection remains in force for invoice items. Delete payments first
    // and reset only these disposable invoices before removing their items.
    await db.query("delete from public.payments where customer_id=$1 and tenant_id=$2",[fixture.customer,DEMO_TENANT]);
    await db.query("update public.invoices set status='Draft',paid_amount=0 where customer_id=$1 and tenant_id=$2",[fixture.customer,DEMO_TENANT]);
    await db.query("delete from public.invoice_items where invoice_id in(select id from public.invoices where customer_id=$1 and tenant_id=$2)",[fixture.customer,DEMO_TENANT]);
    for(const table of ["invoices","work_order_part_financials","cost_records","service_charges","project_variations","project_financials","amc_financials"])
      await db.query(`delete from public.${table} where customer_id=$1 and tenant_id=$2`,[fixture.customer,DEMO_TENANT]);
    await db.query("delete from public.financial_audit where tenant_id=$2 and (customer_id=$1 or before_data->>'invoice_id'=any($3::text[]) or after_data->>'invoice_id'=any($3::text[]))",[fixture.customer,DEMO_TENANT,invoiceIds]);
    await db.query("delete from public.activity_log where customer_id=$1 and tenant_id=$2",[fixture.customer,DEMO_TENANT]);
    await db.query("delete from public.work_orders where customer_id=$1 and tenant_id=$2",[fixture.customer,DEMO_TENANT]);
    await db.query("delete from public.complaints where customer_id=$1 and tenant_id=$2",[fixture.customer,DEMO_TENANT]);
    await db.query("delete from public.equipment where customer_id=$1 and tenant_id=$2",[fixture.customer,DEMO_TENANT]);
    await db.query("delete from public.amc_contracts where customer_id=$1 and tenant_id=$2",[fixture.customer,DEMO_TENANT]);
    await db.query("delete from public.projects where customer_id=$1 and tenant_id=$2",[fixture.customer,DEMO_TENANT]);
    await db.query("delete from public.sites where customer_id=$1 and tenant_id=$2",[fixture.customer,DEMO_TENANT]);
    await db.query("delete from public.customers where id=$1 and tenant_id=$2",[fixture.customer,DEMO_TENANT]);
    await db.query("commit");
  }catch(error){await db.query("rollback");throw error;}finally{await db.end();}
}
