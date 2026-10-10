import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { createFinanceLiveFixture, cleanupFinanceLiveFixture, financeLogin, type FinanceLiveFixture } from "../scripts/finance-live-fixture";
import { addMoney, formatMoney } from "../src/lib/money";
import { accounts } from "../scripts/demo-data";

loadEnvFile(".env.local");
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 15000, navigationTimeout: 45000 });
let fixture: FinanceLiveFixture;
let invoice: string;
let password: string;
const evidence: Record<string, unknown> = {};
const runtimeErrors: string[] = [];

async function login(page: Page, role: string) {
  const account = accounts.find(a => a.role === role)!;
  page.on("pageerror", error => runtimeErrors.push(`${new URL(page.url()).pathname}: ${error.message}`));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Sign in to workspace/ }).click();
  await expect(page).toHaveURL(role === "engineer" ? /\/field/ : /\/dashboard/, { timeout: 60000 });
}
function metric(page: Page, label: string) {
  return page.locator(".financial-metrics article").filter({ has: page.getByRole("heading", { name: label, exact: true }) }).locator("strong");
}
async function healthy(page: Page) {
  await expect(page.locator("main h1")).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".error-panel")).toHaveCount(0);
}
async function serviceReport(page: Page, amount: string) {
  await page.goto(`/reports?report=paid-service-revenue&customer=${fixture.customer}`);
  await healthy(page);
  await expect(metric(page, "Collected service payments")).toHaveText(formatMoney(amount));
}

test.beforeAll(async () => {
  test.setTimeout(120000);
  ({ password } = JSON.parse(await readFile("demo-credentials.local.json", "utf8")));
  fixture = await createFinanceLiveFixture();
  const db = await financeLogin("accounts_finance");
  const saved = await db.rpc("am_finance_save", { entity: "service_charges", target: null, payload: {
    name: fixture.label, customer_id: fixture.customer, work_order_id: fixture.work,
    inspection_fee: "0", labour_charge: "1000", parts_charge: "0", other_charges: "0", discount: "0", tax: "0",
  } });
  if (saved.error) throw saved.error;
  const approved = await db.rpc("am_service_approve", { charge: saved.data });
  if (approved.error) throw approved.error;
});

test.afterAll(async () => {
  test.setTimeout(120000);
  if (fixture) await cleanupFinanceLiveFixture(fixture);
  await mkdir("artifacts/finance-closeout", { recursive: true });
  await writeFile(`artifacts/finance-closeout/browser-${test.info().project.name}.json`, JSON.stringify({ evidence, runtimeErrors, cleaned: true }, null, 2));
});

test("Accounts creates/ issues a service invoice and records partial/final payments; Owner sees live collections", async ({ page, browser }) => {
  test.setTimeout(240000);
  const owner = await financeLogin("owner_director");
  const { data: baseline, error } = await owner.rpc("am_financial_overview");
  expect(error).toBeNull();
  await login(page, "accounts_finance");
  await page.goto(`/invoices/new?customer_id=${fixture.customer}&source_type=Service&work_order_id=${fixture.work}`);
  await page.getByLabel("Description *", { exact: true }).fill(fixture.label);
  await page.getByLabel("Due date *", { exact: true }).fill(fixture.future);
  await page.getByRole("button", { name: "Create invoice", exact: true }).click();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+(?:\?|$)/, { timeout: 60000 });
  invoice = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.goto(`/invoice_items/new?invoice_id=${invoice}`);
  await page.getByLabel("Description *", { exact: true }).fill("Browser verified paid service");
  await page.getByLabel("Unit *", { exact: true }).fill("Job");
  await page.getByLabel("Unit price (OMR) *", { exact: true }).fill("1000.000");
  await page.getByLabel("Tax (%) *", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Create invoice item", exact: true }).click();
  await expect(page).toHaveURL(/\/invoice_items\/[0-9a-f-]+(?:\?|$)/, { timeout: 60000 });
  await page.goto(`/invoices/${invoice}`);
  await expect(metric(page, "total")).toHaveText("OMR 1,000.000");
  await page.getByRole("button", { name: "Issue invoice", exact: true }).click();
  await expect(page.getByText("Issued", { exact: true }).first()).toBeVisible({ timeout: 60000 });
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  try {
    await login(ownerPage, "owner_director");
    await serviceReport(ownerPage, "0.000");
    for (const [amount, remaining, total] of [["400.000", "600.000", "400.000"], ["600.000", "0.000", "1000.000"]]) {
      await page.goto(`/payments/new?invoice_id=${invoice}`);
      await page.getByLabel("Description *", { exact: true }).fill(fixture.label);
      await page.getByLabel("Payment amount (OMR) *", { exact: true }).fill(amount);
      await page.getByRole("button", { name: "Create payment", exact: true }).click();
      await expect(page).toHaveURL(/\/payments\/[0-9a-f-]+(?:\?|$)/, { timeout: 60000 });
      await page.goto(`/invoices/${invoice}`);
      await expect(metric(page, "balance")).toHaveText(formatMoney(remaining));
      await expect(page.getByText(remaining === "0.000" ? "Paid" : "Partially Paid", { exact: true }).first()).toBeVisible();
      await page.goto(`/receivables?customer_id=${fixture.customer}`);
      if (remaining === "0.000") await expect(page.locator("main tbody tr").filter({hasText:fixture.label})).toHaveCount(0);
      else await expect(page.locator("main").getByText("OMR 600.000", { exact: true }).filter({visible:true}).first()).toBeVisible();
      await serviceReport(ownerPage, total);
      await ownerPage.goto("/dashboard");
      await expect(metric(ownerPage, "Revenue collected")).toHaveText(formatMoney(addMoney([baseline.collected, total])));
      await expect(metric(ownerPage, "Outstanding receivables")).toHaveText(formatMoney(addMoney([baseline.outstanding, remaining])));
    }
    evidence.accounts = "Created invoice and item; issued; received 400 then 600; saw balance 600 then 0, Partially Paid then Paid, and receivables disappearance";
    evidence.ownerCollections = "Dashboard and Paid Service Revenue changed 0 → 400 → 1000 from browser-recorded payments";
  } finally { await ownerContext.close(); }
});

test("Owner verifies dashboard, quotations, project financials, invoices, receivables and all requested reports", async ({ page }) => {
  test.setTimeout(180000);
  await login(page, "owner_director");
  const timings: Record<string, number> = {};
  for (const path of ["/dashboard", "/quotations", `/projects/${fixture.project}?tab=financials`, "/invoices", "/receivables"]) {
    const start = Date.now(); await page.goto(path); await healthy(page); timings[path] = Date.now() - start;
  }
  await page.goto(`/projects/${fixture.project}?tab=financials`);
  await expect(metric(page, "gross profit")).toHaveText("OMR 750.000");
  const totals: Record<string, string> = {
    "outstanding-receivables": "0.000", "payment-history": "1000.000", "receivables-aging": "0.000",
    "project-financial-summary": "2000.000", "project-profitability": "750.000", "amc-contract-value": "3000.000",
    "paid-service-revenue": "1000.000", "customer-financial-history": "1000.000",
  };
  const metricLabels: Record<string, string> = {
    "outstanding-receivables": "balance", "payment-history": "amount", "receivables-aging": "balance",
    "project-financial-summary": "project revenue", "project-profitability": "gross profit", "amc-contract-value": "contract value",
    "paid-service-revenue": "Collected service payments", "customer-financial-history": "total",
  };
  for (const [key, amount] of Object.entries(totals)) {
    await page.goto(`/reports?report=${key}&customer=${fixture.customer}`); await healthy(page);
    await expect(metric(page, metricLabels[key])).toHaveText(formatMoney(amount));
    expect(await page.locator("main tbody tr").count()).toBeLessThanOrEqual(20);
  }
  await serviceReport(page, "1000.000");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV", exact: true }).click();
  const csv = await readFile((await (await download).path())!, "utf8");
  expect(csv).toContain("400.000"); expect(csv).toContain("600.000"); expect(csv).not.toContain('"1000.000"');
  await page.screenshot({ path: `artifacts/finance-closeout/owner-${test.info().project.name}.png`, fullPage: true });
  evidence.owner = { workflows: "dashboard, quotations, project financials, invoices, receivables, eight reports and collected-payment CSV", timings };
});

test("Management reads permitted finance information", async ({ page }) => {
  test.setTimeout(120000); await login(page, "management");
  for (const path of ["/dashboard", "/invoices", "/payments", "/receivables", `/projects/${fixture.project}?tab=financials`, `/reports?report=project-profitability&customer=${fixture.customer}`]) {
    await page.goto(path); await healthy(page);
  }
  await page.goto(`/invoices/${invoice}`); await expect(metric(page, "balance")).toHaveText("OMR 0.000");
  await expect(page.getByRole("link", { name: "Record payment", exact: true })).toHaveCount(0);
  evidence.management = "Permitted dashboard, invoices, payments, receivables, project financials and profitability report rendered";
});

test("Engineer is denied finance screens, reports, exports and company dashboard", async ({ page }) => {
  test.setTimeout(120000); await login(page, "engineer");
  for (const path of ["/invoices", `/invoices/${invoice}`, "/payments", "/receivables", "/project_financials", "/reports?report=paid-service-revenue"]) {
    await page.goto(path);
    await expect(page.getByRole("heading",{name:"404",exact:true})).toBeVisible();
    await expect(page.getByText("This page could not be found.",{exact:true})).toBeVisible();
    await expect(page.locator(".financial-metrics")).toHaveCount(0);
  }
  await page.goto("/dashboard"); await expect(page).toHaveURL(/\/field/);
  await expect(page.getByRole("heading", { name: "Business Overview", exact: true })).toHaveCount(0);
  await page.goto(`/projects/${fixture.project}?tab=financials`);
  await expect(page.locator(".financial-metrics")).toHaveCount(0);
  const denied = await page.request.get("/api/export?report=paid-service-revenue");
  expect(denied.status()).toBe(403);
  expect(runtimeErrors).toEqual([]);
  evidence.engineer = "Finance routes render the not-found page; company dashboard redirects to field; finance metrics absent; export returns 403";
});
