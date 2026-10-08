import { createClient, type User } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
import { accounts, buildDataset, DEMO_PROJECT, DEMO_TENANT, insertOrder } from "./demo-data";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local. No records were changed.",
  );
if (
  new URL(url).hostname !== `${DEMO_PROJECT}.supabase.co` ||
  process.env.DEMO_PROJECT_REF !== DEMO_PROJECT
)
  throw new Error("The dedicated AIRMECH Supabase project must match DEMO_PROJECT_REF.");
console.log(`Seed target: ${DEMO_PROJECT} / tenant AIRMECH ONE Demo (${DEMO_TENANT})`);
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function checked(task: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await task;
  if (error) throw new Error(error.message);
}
const reset = process.argv.includes("--reset");
if (reset) {
  if (process.env.DEMO_RESET_CONFIRM !== DEMO_PROJECT)
    throw new Error(`Set DEMO_RESET_CONFIRM=${DEMO_PROJECT} to confirm this isolated demo reset.`);
  await checked(db.rpc("am_reset_demo", { expected_project: DEMO_PROJECT }));
  console.log("Only identified demo-tenant records reset. Other tenants and auth users preserved.");
}
await checked(
  db.from("tenants").upsert({ id: DEMO_TENANT, name: "AIRMECH ONE Demo", is_demo: true }),
);
let password = process.env.DEMO_PASSWORD;
if (!password) {
  try {
    password = JSON.parse(await readFile("demo-credentials.local.json", "utf8")).password;
  } catch {
    password = randomBytes(24).toString("base64url");
  }
}
if (!password || password.length < 14)
  throw new Error("Use a demo password at least 14 characters long.");
const existing: User[] = [];
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw new Error(error.message);
  existing.push(...data.users);
  if (data.users.length < 200) break;
}
const profiles: Record<string, string> = {};
for (const account of accounts) {
  let user = existing.find((u) => u.email === account.email);
  if (user) {
    const { data: profile, error } = await db
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (profile && profile.tenant_id !== DEMO_TENANT)
      throw new Error(`Account ${account.email} belongs to another tenant; refusing to modify it.`);
    if (!profile && user.app_metadata.airmech_demo_tenant !== DEMO_TENANT)
      throw new Error(
        `Account ${account.email} is not identified as an AIRMECH demo user; refusing to modify it.`,
      );
    await checked(db.auth.admin.updateUserById(user.id, { password, email_confirm: true }));
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: account.name },
      app_metadata: { airmech_demo_tenant: DEMO_TENANT },
    });
    if (error || !data.user) throw new Error(error?.message ?? "Auth creation failed");
    user = data.user;
  }
  profiles[account.role] = user.id;
  await checked(
    db
      .from("profiles")
      .upsert({ id: user.id, tenant_id: DEMO_TENANT, full_name: account.name, role: account.role }),
  );
}
const dataset = buildDataset(profiles);
for (const table of insertOrder) {
  const rows = dataset[table] ?? [];
  if (!rows.length) continue;
  // Re-running seed does not overwrite mutations; a reset is explicit.
  const { data: present, error } = await db
    .from(table)
    .select("id")
    .eq("tenant_id", DEMO_TENANT)
    .in(
      "id",
      rows.map((r) => r.id),
    );
  if (error) throw new Error(error.message);
  const seen = new Set((present ?? []).map((r) => r.id));
  const missing = rows.filter((r) => !seen.has(r.id));
  if (missing.length) await checked(db.from(table).insert(missing));
  console.log(`${table}: ${missing.length} inserted, ${rows.length - missing.length} preserved`);
}
for (const document of dataset.documents) {
  const body = `AIRMECH ONE · COMMISSIONING CHECKLIST\nFictional demonstration document\nAsset: ${dataset.equipment.find((e) => e.id === document.equipment_id)?.name}\n\nElectrical isolation verified.\nMechanical connections inspected.\nFilters and coils inspected and cleaned.\nTemperature and electrical readings recorded.\nSystem operation witnessed by facility representative.\n\nRefer to the linked service report for the completed visit.\n`;
  const { error } = await db.storage
    .from("airmech-documents")
    .upload(String(document.storage_path), body, { contentType: "text/plain", upsert: true });
  if (error) throw new Error(error.message);
}
await writeFile(
  "demo-credentials.local.json",
  JSON.stringify(
    {
      project: DEMO_PROJECT,
      password,
      accounts: accounts.map((a) => ({ email: a.email, role: a.role })),
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  "Demo ready. Credentials saved to ignored demo-credentials.local.json; passwords were not printed.",
);
