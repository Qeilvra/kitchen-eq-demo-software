import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccess,
  quotationTotals,
  classifyService,
  validTransition,
  safeReturnPath,
} from "../src/lib/domain";
import { csvCell } from "../src/lib/reports";
import { buildDataset, seedId, DEMO_TENANT, insertOrder } from "../scripts/demo-data";
test("quotation totals apply item discount before VAT and retain OMR precision", () => {
  assert.deepEqual(
    quotationTotals([
      { quantity: 2, unit_price: 450, discount: 5, tax: 5 },
      { quantity: 1, unit_price: 120, discount: 0, tax: 5 },
    ]),
    { subtotal: '975.000', tax: '48.750', total: '1023.750' },
  );
});
test("engineer role cannot access commercial data or user administration", () => {
  for (const entity of [
    "quotations",
    "quotation_items",
    "enquiries",
    "projects",
    "amc_contracts",
    "profiles",
  ])
    assert.equal(canAccess("engineer", entity), false, entity);
  assert.equal(canAccess("engineer", "work_orders"), true);
  assert.equal(canAccess("engineer", "work_orders", true), false);
  assert.equal(canAccess("engineer", "work_order_readings", true), true);
  assert.equal(canAccess("sales_admin", "work_orders"), false);
  assert.equal(canAccess("service_manager", "quotations"), false);
});
test("service classification prefers active warranty, then AMC, then paid service", () => {
  assert.equal(classifyService("2026-10-08", "2027-01-01", "2026-10-08"), "Warranty Service");
  assert.equal(classifyService("2026-10-07", "2026-12-01", "2026-10-08"), "AMC Service");
  assert.equal(classifyService(null, null, "2026-10-08"), "Paid Service");
});
test("completed work cannot restart and travel cannot skip directly to completion", () => {
  assert.equal(validTransition("Assigned", "Travelling"), true);
  assert.equal(validTransition("Travelling", "Completed"), false);
  assert.equal(validTransition("In Progress", "Completed"), true);
  assert.equal(validTransition("Completed", "Assigned"), false);
});
test("redirects and CSV exports resist protocol-relative URLs and spreadsheet formulas", () => {
  assert.equal(safeReturnPath("//evil.example"), "/dashboard");
  assert.equal(safeReturnPath("/customers/abc"), "/customers/abc");
  assert.equal(csvCell("=HYPERLINK(1)"), '"\'=HYPERLINK(1)"');
  assert.equal(csvCell('hello "world"'), '"hello ""world"""');
});
test("seed is deterministic and all customer/site/equipment/work-order links agree", () => {
  const data = buildDataset(
    {
      super_admin: seedId(30, 0),
      management: seedId(30, 1),
      sales_admin: seedId(30, 2),
      service_manager: seedId(30, 3),
      engineer: seedId(30, 4),
    },
    new Date("2026-10-08T09:00:00Z"),
  );
  assert.equal(data.customers.length, 16);
  assert.equal(data.sites.length, 24);
  assert.equal(data.equipment.length, 40);
  assert.equal(data.work_orders.length, 40);
  assert.equal(data.service_reports.length, 22);
  assert.ok(new Set(data.equipment.map((asset) => asset.type)).size >= 14);
  assert.ok(data.projects.some((project) => project.type === "Marine Maintenance"));
  assert.ok(data.engineers.some((engineer) => engineer.specialization === "BMS & Controls"));
  assert.equal(data.equipment[0].code, "CH-03");
  for (const table of insertOrder)
    for (const row of data[table] ?? []) {
      assert.equal(row.tenant_id, DEMO_TENANT);
      if (row.customer_id && row.site_id)
        assert.equal(
          data.sites.find((s) => s.id === row.site_id)?.customer_id,
          row.customer_id,
          `${table}: customer/site`,
        );
      if (row.equipment_id && row.site_id)
        assert.equal(
          data.equipment.find((e) => e.id === row.equipment_id)?.site_id,
          row.site_id,
          `${table}: equipment/site`,
        );
      if (row.work_order_id && row.equipment_id)
        assert.equal(
          data.work_orders.find((w) => w.id === row.work_order_id)?.equipment_id,
          row.equipment_id,
          `${table}: job/equipment`,
        );
    }
  for (const visit of data.pm_schedules.filter((p) => p.work_order_id)) {
    const work = data.work_orders.find((w) => w.id === visit.work_order_id)!;
    assert.equal(work.equipment_id, visit.equipment_id);
    assert.equal(work.engineer_id, visit.engineer_id);
  }
  assert.deepEqual(
    data,
    buildDataset(
      {
        super_admin: seedId(30, 0),
        management: seedId(30, 1),
        sales_admin: seedId(30, 2),
        service_manager: seedId(30, 3),
        engineer: seedId(30, 4),
      },
      new Date("2026-10-08T09:00:00Z"),
    ),
  );
});
