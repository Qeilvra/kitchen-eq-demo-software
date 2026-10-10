import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createFinanceLiveFixture, cleanupFinanceLiveFixture, financeLogin } from "./finance-live-fixture";
import { financialReports } from "../src/lib/financial-reports";
import { addMoney, subtractMoney } from "../src/lib/money";

const fixture = await createFinanceLiveFixture();
const results: Record<string, unknown> = { fixture: fixture.label };
try {
  const accounts=await financeLogin("accounts_finance"),owner=await financeLogin("owner_director"),management=await financeLogin("management"),engineer=await financeLogin("engineer"),admin=await financeLogin("super_admin");
  async function rpc(client: typeof accounts, name:string,args:Record<string,unknown>={}) {
    const {data,error}=await client.rpc(name,args);if(error)throw new Error(`${name}: ${error.message}`);return data;
  }
  async function report(key:string) {return rpc(owner,"am_financial_report",{report_key:key,customer:fixture.customer,page:1,size:20});}
  async function save(entity:string,payload:Record<string,unknown>) {return rpc(accounts,"am_finance_save",{entity,target:null,payload});}
  async function invoice(source:Record<string,unknown>,due=fixture.future) {
    const id=await save("invoices",{name:fixture.label,customer_id:fixture.customer,invoice_date:due===fixture.past?fixture.past:fixture.today,due_date:due,...source});
    await save("invoice_items",{name:"Controlled service work",invoice_id:id,quantity:"1.000",unit_price:"1000.000",discount:"0",tax:"0"});
    await rpc(accounts,"am_invoice_stage",{invoice:id,next_status:"Issued"});return id;
  }
  async function pay(invoice:string,amount:string,request=randomUUID()) {return rpc(accounts,"am_payment_record",{invoice,payload:{amount,payment_date:fixture.today,method:"Bank Transfer",transaction_reference:fixture.label},request});}
  async function readInvoice(id:string) {return (await rpc(owner,"am_finance_read",{entity:"invoices",target:id})).records[0];}
  const baseline=await rpc(owner,"am_financial_overview");
  const charge=await save("service_charges",{name:fixture.label,customer_id:fixture.customer,work_order_id:fixture.work,labour_charge:"1000",inspection_fee:"0",parts_charge:"0",other_charges:"0",discount:"0",tax:"0"});
  await rpc(accounts,"am_service_approve",{charge});
  const paid=await invoice({source_type:"Service",work_order_id:fixture.work});
  assert.equal((await readInvoice(paid)).total,"1000.000");
  assert.equal((await report("paid-service-revenue")).summary.total,"0.000");
  const request=randomUUID(),first=await pay(paid,"400.000",request);
  assert.equal(await pay(paid,"400.000",request),first,"Duplicate request must not record money twice");
  assert.equal((await readInvoice(paid)).balance,"600.000");
  assert.equal((await readInvoice(paid)).status,"Partially Paid");
  assert.equal((await report("paid-service-revenue")).summary.total,"400.000");
  assert.equal((await report("outstanding-receivables")).summary.total,"600.000");
  let overview=await rpc(owner,"am_financial_overview");
  assert.equal(overview.collected,addMoney([baseline.collected,"400.000"]));
  assert.equal(overview.outstanding,addMoney([baseline.outstanding,"600.000"]));
  const excessive=await accounts.rpc("am_payment_record",{invoice:paid,payload:{amount:"600.001",payment_date:fixture.today,method:"Bank Transfer"},request:randomUUID()});assert.ok(excessive.error?.message.match(/balance|exceed/i));
  const final=await pay(paid,"600.000");
  assert.equal((await readInvoice(paid)).status,"Paid");assert.equal((await readInvoice(paid)).balance,"0.000");
  assert.equal((await report("paid-service-revenue")).summary.total,"1000.000");assert.equal((await report("outstanding-receivables")).count,0);
  overview=await rpc(owner,"am_financial_overview");assert.equal(overview.collected,addMoney([baseline.collected,"1000.000"]));assert.equal(overview.outstanding,baseline.outstanding);
  await rpc(accounts,"am_payment_adjust",{payment:first,payload:{},reverse:true,reason:"Controlled closeout reversal"});
  assert.equal((await report("paid-service-revenue")).summary.total,"600.000");assert.equal((await readInvoice(paid)).balance,"400.000");
  const amc=await invoice({source_type:"AMC",amc_id:fixture.amc});await pay(amc,"1000.000");
  const project=await invoice({source_type:"Project",project_id:fixture.project},fixture.past);await pay(project,"100.000");
  assert.equal((await readInvoice(project)).status,"Overdue");
  const general=await invoice({source_type:"General"});await pay(general,"1000.000");
  // An approved explicit warranty charge is eligible; covered AMC service is not.
  for (const [work,amount] of [[fixture.warrantyWork,"200.000"],[fixture.coveredWork,"1000.000"]]) {
    const extra=await rpc(admin,"am_finance_save",{entity:"service_charges",target:null,payload:{name:fixture.label,customer_id:fixture.customer,work_order_id:work,labour_charge:"1000",inspection_fee:"0",parts_charge:"0",other_charges:"0",discount:"0",tax:"0",extra_charge_reason:"Explicitly chargeable extra work approved for verification"}});
    await rpc(admin,"am_service_approve",{charge:extra});const id=await invoice({source_type:"Service",work_order_id:work});await pay(id,amount);
  }
  assert.equal((await report("paid-service-revenue")).summary.total,"800.000");
  assert.equal((await report("project-financial-summary")).summary.total,"2000.000");assert.equal((await report("project-profitability")).summary.total,"750.000");assert.equal((await report("amc-contract-value")).summary.total,"3000.000");
  assert.equal((await report("receivables-aging")).summary.groups.find((g:{label:string})=>g.label==="90+ Days")?.value,"900.000");
  for (const r of financialReports) {const data=await report(r.key);assert.ok(data.summary);results[r.key]={count:data.count,total:data.summary.total};}
  const amcSummary=(await rpc(owner,"am_finance_read",{entity:"amc_financial_summary",filters:{amc_id:fixture.amc}})).records[0];assert.equal(amcSummary.amount_paid,"1000.000");assert.equal(amcSummary.outstanding,"0.000");
  const projectSummary=(await rpc(owner,"am_finance_read",{entity:"project_financial_summary",filters:{project_id:fixture.project}})).records[0];assert.equal(projectSummary.paid_amount,"100.000");assert.equal(projectSummary.outstanding_amount,"900.000");
  await rpc(admin,"am_payment_adjust",{payment:final,payload:{},reverse:true,reason:"Controlled cancellation verification"});await rpc(admin,"am_invoice_stage",{invoice:paid,next_status:"Cancelled",reason:"Controlled closeout cancellation"});
  assert.equal((await report("paid-service-revenue")).summary.total,"200.000");
  for (const entity of ["invoices","payments","receivables","project_financials"]) {const {data,error}=await engineer.from(entity).select("id");assert.equal(error,null);assert.deepEqual(data,[]);const denied=await engineer.rpc("am_finance_read",{entity});assert.ok(denied.error?.message.match(/permission/));}
  assert.ok((await engineer.rpc("am_financial_overview")).error);
  for (const client of [owner,management]) {assert.ok(await rpc(client,"am_financial_overview"));assert.ok((await client.rpc("am_payment_record",{invoice:project,payload:{amount:"1",payment_date:fixture.today,method:"Cash"},request:randomUUID()})).error);}
  results.authorization="Owner/management reads allowed; owner/management payment writes denied; engineer finance reads/RPCs denied";
  results.payment_integrity="Partial/final/multiple payments, retry idempotency, reversal, overpayment prevention, cancellation, overdue status and server balances verified";
  results.dashboard_collected_delta=subtractMoney(overview.collected,baseline.collected);
  await mkdir("artifacts/finance-closeout",{recursive:true});await writeFile("artifacts/finance-closeout/live.json",JSON.stringify(results,null,2));
  console.log("Hosted Supabase finance verification passed:",JSON.stringify(results));
}finally{await cleanupFinanceLiveFixture(fixture);console.log("Disposable hosted finance fixture and its test-only audit records cleaned.");}
