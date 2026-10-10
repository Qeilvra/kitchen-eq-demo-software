import test from "node:test";
import assert from "node:assert/strict";
import {
  dateKey,
  datedValues,
  expiryValues,
  groupValues,
  groupedAmounts,
} from "../src/components/chart-data";
import type { RecordRow } from "../src/lib/domain";

const row = (values: Partial<RecordRow>) =>
  ({
    id: "record",
    tenant_id: "tenant",
    name: "Record",
    code: "REF-1",
    status: "Active",
    created_at: "2026-10-01T12:00:00Z",
    ...values,
  }) as RecordRow;

test("operational dates keep Muscat day boundaries and omit missing/invalid dates", () => {
  assert.equal(dateKey("2026-10-10T21:30:00Z"), "2026-10-11");
  assert.equal(dateKey("2026-10-10T19:30:00Z"), "2026-10-10");
  assert.equal(dateKey(null), "");
  assert.equal(dateKey("invalid"), "");
});

test("quotation trend sums actual OMR values without inventing dates", () => {
  assert.deepEqual(
    datedValues(
      [
        row({ quotation_date: "2026-10-10", quotation_amount: 10.125 }),
        row({ quotation_date: "2026-10-10", quotation_amount: 12.376 }),
        row({ quotation_date: null, quotation_amount: 500 }),
        row({ quotation_date: "2026-10-11", quotation_amount: 0 }),
      ],
      "quotation_date",
      "quotation_amount",
    ),
    [
      { label: "10 Oct", values: [22.501] },
      { label: "11 Oct", values: [0] },
    ],
  );
});

test("expiry charts keep year boundaries and leave undated records out", () => {
  const result = expiryValues(
    [
      row({ end_date: "2027-01-05" }),
      row({ end_date: "2026-12-30" }),
      row({ end_date: "2027-01-21" }),
      row({ end_date: null }),
    ],
    "end_date",
  );
  assert.deepEqual(
    result.map(({ label, value }) => ({ label, value })),
    [
      { label: "Dec 2026", value: 1 },
      { label: "Jan 2027", value: 2 },
    ],
  );
});

test("workload grouping distinguishes recorded assignments from unassigned jobs", () => {
  const values = groupValues(
    [
      row({ engineer_id: "engineer-a" }),
      row({ engineer_id: "engineer-a" }),
      row({ engineer_id: "engineer-b" }),
      row({ engineer_id: null }),
    ],
    "engineer_id",
    (value) => (value === "Unspecified" ? "Unassigned" : value),
  );
  assert.deepEqual(
    values.map(({ label, value }) => ({ label, value })),
    [
      { label: "engineer-a", value: 2 },
      { label: "engineer-b", value: 1 },
      { label: "Unassigned", value: 1 },
    ],
  );
});

test("single-date quotations compare recorded status values without inventing a trend", () => {
  const result = groupedAmounts(
    [
      row({ status: "Sent", quotation_amount: 10.125 }),
      row({ status: "Sent", quotation_amount: 12.376 }),
      row({ status: "Approved", quotation_amount: 30.5 }),
      row({ status: "Draft" }),
    ],
    "status",
    "quotation_amount",
  );
  assert.deepEqual(
    result.map(({ label, value }) => ({ label, value })),
    [
      { label: "Approved", value: 30.5 },
      { label: "Sent", value: 22.501 },
    ],
  );
});
