import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { financeDatabase } from "./finance-db";
import { financeFixture } from "../tests/finance-fixture";

const db = await financeDatabase();
const local = await financeFixture();
const checks: Record<string, string> = {
  tables: `select c.relname name,c.relkind kind,c.relrowsecurity rls,c.relforcerowsecurity force_rls,c.reloptions options
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v') order by name`,
  columns: `select table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,numeric_precision,numeric_scale,is_generated,generation_expression
    from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
  constraints: `select c.relname relation,k.conname name,k.contype type,pg_get_constraintdef(k.oid) definition
    from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and k.contype<>'n' order by relation,name`,
  indexes: `select tablename relation,indexname name,indexdef definition from pg_indexes where schemaname='public' order by relation,name`,
  views: `select c.relname name,pg_get_viewdef(c.oid,true) definition from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' order by name`,
  functions: `select p.proname name,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef definer,p.proconfig config,pg_get_functiondef(p.oid) definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'am_%' order by name,arguments`,
  triggers: `select c.relname relation,t.tgname name,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and not t.tgisinternal order by relation,name`,
  policies: `select tablename relation,policyname name,permissive,roles::text roles,cmd,qual,with_check from pg_policies where schemaname='public' order by relation,name`,
  grants: `select table_name,grantee,privilege_type,is_grantable from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') order by table_name,grantee,privilege_type`,
};
try {
  const files = (await readdir("supabase/migrations")).filter(f => f.endsWith(".sql")).sort();
  const { rows: ledger } = await db.query<{ name: string; checksum: string; applied_at: Date }>("select name,checksum,applied_at from airmech_meta.migrations order by name");
  assert.deepEqual(ledger.map(r => r.name), files, "Hosted migration ledger differs from local migration sequence.");
  for (let i = 0; i < files.length; i++) {
    assert.equal(ledger[i].checksum, createHash("sha256").update(await readFile(`supabase/migrations/${files[i]}`, "utf8")).digest("hex"), `Migration checksum mismatch: ${files[i]}`);
    if (i) assert.ok(ledger[i].applied_at >= ledger[i - 1].applied_at, `Migration applied out of order: ${files[i]}`);
  }
  const results: Record<string, unknown> = { migrations: ledger.map(r => r.name) };
  const differences: Record<string, unknown> = {};
  for (const [name, sql] of Object.entries(checks)) {
    const [expected, actual] = await Promise.all([local.query(sql), db.query(sql)]);
    try { assert.deepEqual(actual.rows, expected.rows); results[name] = { matched: true, count: actual.rows.length }; }
    catch { differences[name] = { local: expected.rows, hosted: actual.rows }; }
  }
  await mkdir("artifacts/finance-closeout", { recursive: true });
  await writeFile("artifacts/finance-closeout/schema.json", JSON.stringify({ ...results, differences }, null, 2));
  assert.equal(Object.keys(differences).length, 0, `Hosted schema mismatches: ${Object.keys(differences).join(", ")}. See artifacts/finance-closeout/schema.json.`);
  console.log("Hosted/local schema matched:", JSON.stringify(results));
} finally { await local.close(); await db.end(); }
