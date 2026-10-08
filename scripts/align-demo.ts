import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { accounts, buildDataset, DEMO_PROJECT, DEMO_TENANT, insertOrder } from "./demo-data";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (
  !url ||
  !key ||
  new URL(url).hostname !== `${DEMO_PROJECT}.supabase.co` ||
  process.env.DEMO_PROJECT_REF !== DEMO_PROJECT
)
  throw new Error("The dedicated demo project and server configuration are required.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: tenant, error: tenantError } = await db
  .from("tenants")
  .select("name,is_demo")
  .eq("id", DEMO_TENANT)
  .single();
if (tenantError || !tenant?.is_demo || tenant.name !== "AIRMECH ONE Demo")
  throw new Error("Refusing to update an unidentified demo tenant.");
const { data: profiles, error: profileError } = await db
  .from("profiles")
  .select("id,role,full_name")
  .eq("tenant_id", DEMO_TENANT);
if (profileError || !profiles?.length)
  throw new Error("Existing demo profiles are required; no Auth changes will be made.");
const profileIds = Object.fromEntries(profiles.map((profile) => [profile.role, profile.id]));
const dataset = buildDataset(profileIds);
const fields: Record<string, string[]> = {
  customers: ["name", "type", "address", "notes"],
  contacts: ["name", "role"],
  sites: ["name", "location", "address", "notes"],
  engineers: ["name", "specialization", "skills"],
  enquiries: ["name", "category", "description"],
  enquiry_activities: ["name", "notes"],
  quotations: ["name", "notes"],
  quotation_items: ["name"],
  projects: ["name", "type", "description"],
  project_engineers: ["name"],
  amc_contracts: ["name", "notes"],
  equipment: ["code", "name", "type", "brand", "model", "capacity", "notes"],
  amc_equipment: ["name"],
  complaints: ["name", "problem", "reported_by"],
  work_orders: ["name", "problem", "diagnosis", "work_performed", "recommendations"],
  service_reports: ["name", "reported_issue", "diagnosis", "work_completed", "recommendations"],
  work_order_readings: ["name", "unit", "value"],
  work_order_parts: ["name"],
  pm_schedules: ["name"],
  pm_visits: ["name"],
  documents: ["name"],
  notifications: ["name"],
};
const snapshot: Record<string, unknown> = { profiles };
for (const table of insertOrder) {
  const rows = dataset[table] ?? [];
  if (!rows.length) continue;
  const { data, error } = await db
    .from(table)
    .select("*")
    .eq("tenant_id", DEMO_TENANT)
    .in(
      "id",
      rows.map((row) => row.id),
    );
  if (error) throw new Error(`Cannot inspect ${table}: ${error.code}`);
  snapshot[table] = data ?? [];
}
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/airmech-alignment-backup.json", JSON.stringify(snapshot, null, 2), {
  mode: 0o600,
});
console.log(
  `Alignment target: ${DEMO_PROJECT} / identified AIRMECH demo tenant. Existing statuses, dates, prices, relationships and credentials will be preserved.`,
);
for (const table of insertOrder) {
  const rows = dataset[table] ?? [];
  if (!rows.length) continue;
  const existing = snapshot[table] as { id: string; status: string }[];
  const byId = new Map(existing.map((row) => [row.id, row]));
  let updated = 0,
    inserted = 0;
  for (const row of rows) {
    const current = byId.get(row.id);
    if (!current) {
      const { error } = await db.from(table).insert(row);
      if (error) throw new Error(`${table} insertion failed (${error.code}).`);
      inserted++;
      continue;
    }
    if (!fields[table]) continue;
    const payload = Object.fromEntries(
      fields[table]
        .filter(
          (field) =>
            row[field] !== undefined &&
            (!(table === "work_orders" || table === "service_reports") ||
              !["diagnosis", "work_performed", "work_completed", "recommendations"].includes(
                field,
              ) ||
              row.status === "Completed"),
        )
        .map((field) => [field, row[field]]),
    );
    const { error } = await db
      .from(table)
      .update(payload)
      .eq("id", row.id)
      .eq("tenant_id", DEMO_TENANT);
    if (error) throw new Error(`${table} example update failed (${error.code}).`);
    updated++;
  }
  console.log(`${table}: ${updated} descriptive updates, ${inserted} new demo records.`);
}
for (const document of dataset.documents) {
  const existing = (snapshot.documents as { id: string; storage_path: string }[]).find(
    (row) => row.id === document.id,
  );
  if (existing && existing.storage_path !== document.storage_path) continue;
  const asset = dataset.equipment.find((row) => row.id === document.equipment_id)!;
  const body = `AIRMECH ONE · OPERATIONS MANAGEMENT SYSTEM\nFictional engineering/service demonstration document\nAsset: ${asset.name}\nCategory: ${asset.type}\n\nAuthorized site access and isolation coordinated.\nMechanical, electrical and control interfaces inspected as applicable.\nOperating condition and service readings recorded.\nTesting and handover witnessed by the site representative.\n\nRefer to the linked work order and service report for visit details.\n`;
  const { error } = await db.storage
    .from("airmech-documents")
    .upload(String(document.storage_path), body, { contentType: "text/plain", upsert: true });
  if (error) throw new Error("Demo document example update failed.");
  const { error: metadataError } = await db
    .from("documents")
    .update({ size_bytes: Buffer.byteLength(body, "utf8") })
    .eq("id", document.id)
    .eq("tenant_id", DEMO_TENANT);
  if (metadataError) throw new Error("Demo document metadata update failed.");
}
for (const account of accounts) {
  const id = profileIds[account.role];
  if (!id) continue;
  const { error } = await db
    .from("profiles")
    .update({ full_name: account.name })
    .eq("id", id)
    .eq("tenant_id", DEMO_TENANT);
  if (error) throw new Error(`Profile display-name update failed (${error.code}).`);
}
console.log(
  "Airmech examples aligned. Auth accounts, passwords, roles, record IDs and working workflows preserved.",
);
