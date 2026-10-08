import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const credentials = JSON.parse(await readFile("demo-credentials.local.json", "utf8")) as {
  password: string;
};
const admin = createClient(url, key, { auth: { persistSession: false } });
const engineer = createClient(url, key, { auth: { persistSession: false } });
for (const [client, email] of [
  [admin, "admin@airmech.demo"],
  [engineer, "engineer@airmech.demo"],
] as const) {
  const { error } = await client.auth.signInWithPassword({ email, password: credentials.password });
  if (error) throw error;
}
const { data: customers, error } = await admin.from("customers").select("id,name").limit(20);
assert.equal(error, null);
assert.ok(customers && customers.length >= 16);
const { data: quotations } = await engineer.from("quotations").select("id");
assert.equal(quotations?.length, 0);
const { data: jobs } = await engineer.from("work_orders").select("id,status").limit(20);
assert.ok(jobs && jobs.length > 0);
const { data: summary, error: summaryError } = await admin.rpc("am_dashboard");
assert.equal(summaryError, null);
assert.ok(summary);
console.log(
  "Live verification passed: demo auth, data, dashboard RPC and engineer RLS. No records changed.",
);
