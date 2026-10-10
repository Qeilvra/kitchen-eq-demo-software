import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  buildDataset,
  DEMO_TENANT,
  DEMO_PROJECT,
  seedId,
  insertOrder,
  accounts,
} from "../scripts/demo-data";
test("PostgreSQL migration, relational seed, RLS and complete sales/service/PM workflow", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'service_role')$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 grant usage on schema auth,storage to authenticated,anon,service_role;
 grant select,insert,delete on storage.objects to authenticated;`);
    const migration = await readFile("supabase/migrations/001_airmech.sql", "utf8");
    await db.exec(migration.replace("create extension if not exists pgcrypto;", ""));
    await db.exec(await readFile("supabase/migrations/002_customer_activity.sql", "utf8"));
    await db.exec(await readFile("supabase/migrations/003_engineer_references.sql", "utf8"));
    for(const file of ['004_commercial_finance','005_finance_workflows','006_financial_intelligence','007_finance_closeout','008_finance_grant_alignment'])await db.exec(await readFile(`supabase/migrations/${file}.sql`,'utf8'));
    const profiles: Record<string, string> = {};
    await db.query("insert into public.tenants values($1,'AIRMECH ONE Demo',true)", [DEMO_TENANT]);
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      profiles[account.role] = seedId(30, i);
      await db.query("insert into auth.users values($1,$2)", [
        profiles[account.role],
        account.email,
      ]);
      await db.query("insert into public.profiles values($1,$2,$3,$4)", [
        profiles[account.role],
        DEMO_TENANT,
        account.name,
        account.role,
      ]);
    }
    const data = buildDataset(profiles);
    for (const table of insertOrder)
      for (const row of data[table] ?? []) {
        const keys = Object.keys(row);
        await db.query(
          `insert into public.${table}(${keys.join(",")}) values(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
          keys.map((key) => row[key]),
        );
      }
    async function login(role: string) {
      await db.exec("reset role");
      await db.query(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",
        [profiles[role]],
      );
      await db.exec("set role authenticated");
    }
    await login("sales_admin");
    const customer = seedId(40, 0),
      site = seedId(41, 0),
      asset = seedId(42, 0);
    await db.query(
      "insert into public.customers(id,tenant_id,name,phone) values($1,$2,'Presentation customer','+968 24001234')",
      [customer, DEMO_TENANT],
    );
    await db.query("update public.customers set name='Updated presentation customer' where id=$1", [
      customer,
    ]);
    assert.equal(
      (
        await db.query<{ name: string }>("select name from public.customers where id=$1", [
          customer,
        ])
      ).rows[0].name,
      "Updated presentation customer",
    );
    await db.query(
      "insert into public.sites(id,tenant_id,name,customer_id,location) values($1,$2,'Muscat test site',$3,'Muscat')",
      [site, DEMO_TENANT, customer],
    );
    await db.query("update public.customers set status='Archived' where id=$1", [customer]);
    assert.equal(
      (await db.query("select * from public.sites where customer_id=$1", [customer])).rows.length,
      1,
    );
    const quote = (await db.query<{ id: string }>("select public.am_quote($1) id", [seedId(5, 18)]))
      .rows[0].id;
    await db.query(
      "insert into public.quotation_items(tenant_id,name,quotation_id,quantity,unit_price,discount,tax) values($1,'Replacement unit',$2,2,450,5,5)",
      [DEMO_TENANT, quote],
    );
    await db.query("select public.am_quote_stage($1,'Sent')", [quote]);
    await db.query("select public.am_quote_stage($1,'Approved')", [quote]);
    const project = (await db.query<{ id: string }>("select public.am_project($1) id", [quote]))
      .rows[0].id;
    assert.ok(project);
    assert.equal(
      (
        await db.query<{ status: string }>("select status from public.enquiries where id=$1", [
          seedId(5, 18),
        ])
      ).rows[0].status,
      "Won",
    );
    await assert.rejects(
      db.query("select public.am_dispatch($1,$2,now())", [seedId(10, 0), seedId(4, 0)]),
      /permission/,
    );
    await login("service_manager");
    await db.query(
      "insert into public.equipment(id,tenant_id,name,customer_id,site_id,warranty_end) values($1,$2,'Test AHU',$3,$4,public.am_today()+120)",
      [asset, DEMO_TENANT, customer, site],
    );
    const checkComplaint = seedId(43, 0);
    await db.query(
      "insert into public.complaints(id,tenant_id,name,customer_id,site_id,equipment_id,problem) values($1,$2,'Test complaint',$3,$4,$5,'Temperature high')",
      [checkComplaint, DEMO_TENANT, customer, site, asset],
    );
    assert.equal(
      (
        await db.query<{ classification: string }>(
          "select classification from public.complaints where id=$1",
          [checkComplaint],
        )
      ).rows[0].classification,
      "Warranty Service",
    );
    await assert.rejects(
      db.query("update public.complaints set status='Resolved' where id=$1", [checkComplaint]),
      /workflow/,
    );
    await db.query("select public.am_complaint_stage($1,'Acknowledged')", [checkComplaint]);
    const job = (
      await db.query<{ id: string }>("select public.am_dispatch($1,$2,now()) id", [
        seedId(10, 0),
        seedId(4, 0),
      ])
    ).rows[0].id;
    await login("engineer");
    assert.equal((await db.query("select * from public.am_engineer_options()")).rows.length, 1);
    assert.equal(
      (await db.query("select * from public.am_engineer_options(array[$1::uuid])", [seedId(4, 1)]))
        .rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.am_set_role($1,'super_admin')", [profiles.engineer]),
      /permission/,
    );
    await db.query(
      "insert into storage.objects(bucket_id,name,owner_id) values('airmech-documents',$1,$2)",
      [data.documents[0].storage_path, profiles.engineer],
    );
    assert.equal((await db.query("select * from storage.objects")).rows.length, 1);
    await assert.rejects(
      db.query(
        "insert into storage.objects(bucket_id,name,owner_id) values('airmech-documents',$1,$2)",
        [data.documents[1].storage_path, profiles.engineer],
      ),
      /row-level security/,
    );
    assert.equal((await db.query("select * from public.quotations")).rows.length, 0);
    assert.ok((await db.query("select * from public.work_orders")).rows.length > 0);
    assert.equal(
      (await db.query("select * from public.customers where id=$1", [seedId(1, 15)])).rows.length,
      0,
    );
    await assert.rejects(
      db.query("update public.profiles set role='super_admin' where id=$1", [profiles.engineer]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.am_work($1,'Completed')", [job]),
      /Invalid work order transition/,
    );
    for (const status of ["Travelling", "On Site", "In Progress"])
      await db.query("select public.am_work($1,$2)", [job, status]);
    await db.query(
      "insert into public.work_order_readings(tenant_id,name,work_order_id,value,unit) values($1,'Leaving water temperature',$2,7.2,'C')",
      [DEMO_TENANT, job],
    );
    await db.query(
      "insert into public.work_order_parts(tenant_id,name,work_order_id,quantity) values($1,'Filter element',$2,2)",
      [DEMO_TENANT, job],
    );
    await assert.rejects(db.query("select public.am_work($1,'Completed')", [job]), /required/);
    const report = (
      await db.query<{ id: string }>(
        "select public.am_work($1,'Completed','Condenser fouled','Cleaned coils and tested under load','Inspect filters monthly','Said Al Farsi confirmed satisfactory operation') id",
        [job],
      )
    ).rows[0].id;
    assert.ok(
      (await db.query("select * from public.service_reports where id=$1", [report])).rows.length,
    );
    assert.equal(
      (
        await db.query<{ status: string }>("select status from public.complaints where id=$1", [
          seedId(10, 0),
        ])
      ).rows[0].status,
      "Resolved",
    );
    await assert.rejects(
      db.query("select public.am_dispatch($1,$2,now())", [seedId(10, 1), seedId(4, 0)]),
      /permission/,
    );
    await assert.rejects(db.query("select public.am_reset_demo($1)", [DEMO_PROJECT]), /permission/);
    await assert.rejects(
      db.query(
        "insert into public.work_orders(tenant_id,name,customer_id,site_id,equipment_id,status) values($1,'Forged completed job',$2,$3,$4,'Completed')",
        [DEMO_TENANT, seedId(1, 0), seedId(3, 0), seedId(9, 0)],
      ),
      /row-level security/,
    );
    await login("service_manager");
    await assert.rejects(
      db.query(
        "insert into public.complaints(tenant_id,name,customer_id,site_id,equipment_id,problem) values($1,'Wrong site',$2,$3,$4,'test')",
        [DEMO_TENANT, seedId(1, 0), seedId(3, 1), seedId(9, 0)],
      ),
      /site does not belong/,
    );
    const pmJob = (
      await db.query<{ id: string }>("select public.am_pm($1,$2,now()) id", [
        seedId(12, 16),
        seedId(4, 0),
      ])
    ).rows[0].id;
    await login("engineer");
    for (const status of ["On Site", "In Progress"])
      await db.query("select public.am_work($1,$2)", [pmJob, status]);
    await db.query(
      "select public.am_work($1,'Completed','Quarterly PM','Cleaned filters, coils and checked terminals','Next visit in 90 days','Facility manager accepted')",
      [pmJob],
    );
    await login("super_admin");
    await db.query("select public.am_sync_notifications()");
    assert.ok(
      (await db.query("select * from public.notifications where name='AMC coverage expiring'")).rows
        .length,
    );
    assert.equal(
      (
        await db.query<{ sites_count: number }>(
          "select * from public.am_customer_metrics(array[$1::uuid])",
          [seedId(1, 0)],
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query<{ status: string }>("select status from public.pm_schedules where id=$1", [
          seedId(12, 16),
        ])
      ).rows[0].status,
      "Completed",
    );
    assert.equal(
      (await db.query("select * from public.pm_visits where schedule_id=$1", [seedId(12, 16)])).rows
        .length,
      1,
    );
    assert.ok((await db.query("select * from public.am_search('Al Noor')")).rows.length);
    await db.query("select public.am_read_notification($1)", [seedId(24, 0)]);
    const summary = (
      await db.query<{ data: { complaints: number } }>("select public.am_dashboard() data")
    ).rows[0].data;
    assert.equal(summary.complaints, 18);
    // Another tenant survives demo reset.
    await db.exec("reset role");
    const other = seedId(31, 0);
    await db.query("insert into public.tenants values($1,'Unrelated business',false)", [other]);
    await db.query("insert into public.customers(tenant_id,name) values($1,'Unrelated customer')", [
      other,
    ]);
    const unprofiled = seedId(32, 0);
    await db.query("insert into auth.users values($1,'unprofiled@example.com')", [unprofiled]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [unprofiled]);
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select public.am_reset_demo($1)", [DEMO_PROJECT]), /permission/);
    await login("super_admin");
    await db.query("select public.am_reset_demo($1)", [DEMO_PROJECT]);
    assert.equal((await db.query("select * from public.customers")).rows.length, 0);
    await db.exec("reset role");
    assert.equal(
      (await db.query("select * from public.customers where tenant_id=$1", [other])).rows.length,
      1,
    );
    assert.equal((await db.query("select * from public.profiles")).rows.length, accounts.length);
  } catch (error) {
    const failure = error as { message: string; where?: string };
    throw new Error(`${failure.message}${failure.where ? ` (${failure.where})` : ""}`);
  } finally {
    await db.close();
  }
});
