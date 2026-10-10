import test from "node:test";
import assert from "node:assert/strict";
import { financeFixture } from "./finance-fixture";
import { financialReportFilters, financialReports } from "../src/lib/financial-reports";
import { calculateTotals, formatMoney, canonicalDecimal } from "../src/lib/money";

test("finance unit: paid service report targets recorded payments and exact OMR arithmetic", () => {
  assert.deepEqual(financialReports.find(r => r.key === "paid-service-revenue"), {
    key: "paid-service-revenue", label: "Paid Service Revenue", entity: "payments", amount: "amount", group: "payment_date",
  });
  assert.deepEqual(financialReportFilters("paid-service-revenue", "customer"), { customer_id: "customer", paid_service: "true", status: "Recorded" });
  assert.equal(calculateTotals([{ quantity: "1", unit_price: "1000", tax: "0" }]).total, "1000.000");
  assert.equal(formatMoney("400.000"), "OMR 400.000");
  assert.throws(() => canonicalDecimal("0.0001"));
});

test("finance integration: source exclusions, partial/multiple payments, reversals, reports and role boundaries", async () => {
  const db = await financeFixture();
  const id = (n: number) => `fc100000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const tenant = id(1), customer = id(2), site = id(3), project = id(4), amc = id(5);
  const roles = ["super_admin", "owner_director", "accounts_finance", "management", "engineer"];
  const today = (await db.query<{today:string}>("select public.am_today()::text today")).rows[0].today;
  const future = (await db.query<{date:string}>("select (public.am_today()+30)::text as date")).rows[0].date;
  const past = (await db.query<{date:string}>("select (public.am_today()-120)::text as date")).rows[0].date;
  let request = 100;
  async function login(role: string) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)", [id(10 + roles.indexOf(role))]);
    await db.exec("set role authenticated");
  }
  async function save(entity: string, payload: object) {
    return (await db.query<{id:string}>("select public.am_finance_save($1,null,$2::jsonb) id", [entity, JSON.stringify(payload)])).rows[0].id;
  }
  async function pay(invoice: string, amount: string) {
    return (await db.query<{id:string}>("select public.am_payment_record($1,$2::jsonb,$3) id", [invoice, JSON.stringify({ amount, payment_date: today, method: "Bank Transfer" }), id(request++)])).rows[0].id;
  }
  type Report = {count:number;records:{id:string}[];summary:{total:string;groups:{label:string;value:string}[]}};
  async function report(key: string, size = 20, page = 1) {
    return (await db.query<{data:Report}>("select public.am_financial_report($1,$2,$3,$4) data", [key, customer, page, size])).rows[0].data;
  }
  async function invoice(source: object, due = future, amount = "1000") {
    const invoice = await save("invoices", { name: "Misleading AMC/warranty/project description", customer_id: customer, invoice_date: due === past ? past : today, due_date: due, ...source });
    await save("invoice_items", { name: "Service line", invoice_id: invoice, quantity: "1", unit_price: amount, discount: "0", tax: "0" });
    await db.query("select public.am_invoice_stage($1,'Issued')", [invoice]);
    return invoice;
  }
  try {
    await db.query("insert into public.tenants(id,name,is_demo) values($1,'Finance closeout fixture',true)", [tenant]);
    for (let n = 0; n < roles.length; n++) {
      await db.query("insert into auth.users values($1,$2)", [id(10 + n), `${roles[n]}@finance.test`]);
      await db.query("insert into public.profiles values($1,$2,$3,$4)", [id(10 + n), tenant, roles[n], roles[n]]);
    }
    await db.query("insert into public.customers(id,tenant_id,name) values($1,$2,'Fixture customer')", [customer, tenant]);
    await db.query("insert into public.sites(id,tenant_id,name,customer_id,location) values($1,$2,'Fixture site',$3,'Muscat')", [site, tenant, customer]);
    await db.query("insert into public.projects(id,tenant_id,name,customer_id,site_id) values($1,$2,'Fixture project',$3,$4)", [project, tenant, customer, site]);
    await db.query("update public.project_financials set base_value=2000,recognized_revenue=1000,actual_cost_override=250 where project_id=$1", [project]);
    await db.query("insert into public.amc_contracts(id,tenant_id,name,customer_id,site_id,start_date,end_date) values($1,$2,'Fixture AMC',$3,$4,$5,$6)", [amc, tenant, customer, site, today, future]);
    await db.query("update public.amc_financials set contract_value=3000 where amc_id=$1", [amc]);
    // Separate equipment establishes paid, covered AMC and warranty classifications.
    for (let n = 0; n < 4; n++) {
      await db.query("insert into public.equipment(id,tenant_id,name,customer_id,site_id,amc_id,warranty_start,warranty_end,code) values($1,$2,'Fixture asset',$3,$4,$5,$6,$7,$8)", [id(30 + n), tenant, customer, site, n === 1 ? amc : null, n >= 2 ? today : null, n >= 2 ? future : null, `ASSET-${n}`]);
      await db.query("insert into public.complaints(id,tenant_id,name,customer_id,site_id,equipment_id,problem,code) values($1,$2,'Fixture case',$3,$4,$5,'Verification',$6)", [id(40 + n), tenant, customer, site, id(30 + n), `CASE-${n}`]);
      await db.query("insert into public.work_orders(id,tenant_id,name,customer_id,site_id,equipment_id,complaint_id,code) values($1,$2,'Fixture job',$3,$4,$5,$6,$7)", [id(50 + n), tenant, customer, site, id(30 + n), id(40 + n), `JOB-${n}`]);
      await db.query("insert into public.service_charges(tenant_id,name,work_order_id,customer_id,labour_charge,tax,status,approved_by,extra_charge_reason) values($1,'Authorized service charge',$2,$3,1000,0,'Approved',$4,$5)", [tenant, id(50 + n), customer, n === 3 ? null : id(10), n === 1 || n === 2 ? "Authorized chargeable extra work" : null]);
    }
    await login("accounts_finance");
    assert.equal((await db.query<{allowed:boolean}>("select has_table_privilege('authenticated','public.invoices','TRUNCATE') allowed")).rows[0].allowed,false);
    await assert.rejects(() => save("invoices", { name: "Invalid source", customer_id: customer, source_type: "Project", invoice_date: today, due_date: future }), /project invoice source/);
    await assert.rejects(() => save("invoices", { name: "Mixed source", customer_id: customer, source_type: "Service", work_order_id: id(50), amc_id: amc, invoice_date: today, due_date: future }), /service job invoice source/);
    const paid = await invoice({ source_type: "Service", work_order_id: id(50) });
    assert.equal((await report("paid-service-revenue")).summary.total, "0.000", "Issued but unpaid invoice must contribute zero");
    const first = await pay(paid, "400");
    assert.equal((await report("paid-service-revenue")).summary.total, "400.000");
    const state = async () => (await db.query<{balance:string;status:string}>("select balance::text balance,status from public.invoices where id=$1", [paid])).rows[0];
    assert.deepEqual(await state(), { balance: "600.000", status: "Partially Paid" });
    assert.equal((await report("outstanding-receivables")).summary.total, "600.000");
    await assert.rejects(() => pay(paid, "600.001"), /balance|exceed/i);
    const final = await pay(paid, "600");
    assert.deepEqual(await state(), { balance: "0.000", status: "Paid" });
    assert.equal((await report("paid-service-revenue")).summary.total, "1000.000");
    assert.equal((await report("outstanding-receivables")).count, 0);
    await db.query("select public.am_payment_adjust($1,'{}',true,'Test reversal')", [first]);
    assert.equal((await report("paid-service-revenue")).summary.total, "600.000");
    assert.deepEqual(await state(), { balance: "400.000", status: "Partially Paid" });
    await assert.rejects(() => db.query("select public.am_payment_adjust($1,'{}',true,'Again')", [first]), /already been reversed/);
    const amcInvoice = await invoice({ source_type: "AMC", amc_id: amc }); await pay(amcInvoice, "1000");
    const projectInvoice = await invoice({ source_type: "Project", project_id: project }, past); await pay(projectInvoice, "100");
    const general = await invoice({ source_type: "General" }); await pay(general, "1000");
    const covered = await invoice({ source_type: "Service", work_order_id: id(51) }); await pay(covered, "1000");
    const warranty = await invoice({ source_type: "Service", work_order_id: id(52) }); await pay(warranty, "200");
    const unchargeable = await invoice({ source_type: "Service", work_order_id: id(53) }); await pay(unchargeable, "1000");
    assert.equal((await report("paid-service-revenue")).summary.total, "800.000", "Only paid-service collections and explicitly chargeable warranty extras count");
    const paged = await report("paid-service-revenue", 1);
    assert.equal(paged.records.length, 1); assert.equal(paged.count, 2); assert.equal(paged.summary.total, "800.000");
    assert.notEqual((await report("paid-service-revenue", 1, 2)).records[0].id, paged.records[0].id);
    assert.equal((await report("receivables-aging")).summary.groups.find(g => g.label === "90+ Days")?.value, "900.000");
    assert.equal((await report("project-financial-summary")).summary.total, "2000.000");
    assert.equal((await report("project-profitability")).summary.total, "750.000");
    assert.equal((await report("amc-contract-value")).summary.total, "3000.000");
    assert.equal((await report("payment-history")).summary.total, "4900.000");
    assert.equal((await report("customer-financial-history")).summary.total, "7000.000");
    assert.equal((await db.query<{status:string}>("select status from public.invoices where id=$1", [projectInvoice])).rows[0].status, "Overdue");
    await login("super_admin");
    await db.query("select public.am_payment_adjust($1,'{}',true,'Disposable verification reversal')", [final]);
    await db.query("select public.am_invoice_stage($1,'Cancelled','Disposable test cancellation')", [paid]);
    assert.equal((await report("paid-service-revenue")).summary.total, "200.000");
    await assert.rejects(() => pay(paid, "1"), /issued/);
    await db.exec("reset role");
    await assert.rejects(() => db.query("update public.invoices set source_type='General',work_order_id=null where id=$1", [paid]), /source is locked/i);
    for (const role of ["owner_director", "management"]) {
      await login(role);
      for (const key of ["outstanding-receivables", "payment-history", "receivables-aging", "project-financial-summary", "project-profitability", "amc-contract-value", "paid-service-revenue", "customer-financial-history"]) assert.ok(await report(key));
      await assert.rejects(() => pay(projectInvoice, "1"), /permission/);
    }
    await login("engineer");
    for (const table of ["invoices", "payments", "receivables", "project_financials", "paid_service_collections"]) assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0, table);
    for (const key of ["paid-service-revenue", "project-profitability", "outstanding-receivables"]) await assert.rejects(() => report(key), /permission/);
    await assert.rejects(() => db.query("select public.am_financial_overview()"), /permission/);
  } finally { await db.close(); }
});
