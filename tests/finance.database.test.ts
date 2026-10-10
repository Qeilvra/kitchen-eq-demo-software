import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {calculateTotals,formatMoney} from '../src/lib/money';
test('exact finance lifecycle, permissions, payment integrity and private audit',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'service_role')$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;grant usage on schema auth,storage to authenticated,anon,service_role;grant select,insert,delete on storage.objects to authenticated;`);
 for(const name of ['001_airmech','002_customer_activity','003_engineer_references','004_commercial_finance','005_finance_workflows','006_financial_intelligence','007_finance_closeout','008_finance_grant_alignment']) await db.exec((await readFile(`supabase/migrations/${name}.sql`,'utf8')).replace('create extension if not exists pgcrypto;',''));
 const id=(n:number)=>`f1000000-0000-4000-8000-${String(n).padStart(12,'0')}`;const tenant=id(1), customer=id(2),site=id(3),project=id(4);
 await db.query("insert into public.tenants values($1,'Finance test',true)",[tenant]);
 const roles=['super_admin','owner_director','management','sales_admin','accounts_finance','service_manager','project_manager','engineer'];
 for(let i=0;i<roles.length;i++){await db.query('insert into auth.users values($1,$2)',[id(10+i),`${roles[i]}@test.local`]);await db.query('insert into public.profiles values($1,$2,$3,$4)',[id(10+i),tenant,roles[i],roles[i]]);}
 await db.query("insert into public.customers(id,tenant_id,name) values($1,$2,'Money customer')",[customer,tenant]);
 await db.query("insert into public.sites(id,tenant_id,name,customer_id,location) values($1,$2,'Site',$3,'Muscat')",[site,tenant,customer]);
 await db.query("insert into public.projects(id,tenant_id,name,customer_id,site_id,manager_id) values($1,$2,'Project',$3,$4,$5)",[project,tenant,customer,site,id(16)]);
 async function login(role:string){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id(10+roles.indexOf(role))]);await db.exec('set role authenticated');}
 async function save(entity:string,payload:object,target:string|null=null){return (await db.query<{id:string}>('select public.am_finance_save($1,$2,$3::jsonb) id',[entity,target,JSON.stringify(payload)])).rows[0].id;}
 await login('accounts_finance');
 const invoice=await save('invoices',{name:'Stage billing',customer_id:customer,source_type:'Project',project_id:project,invoice_date:'2026-01-01',due_date:'2026-02-01'});
 await save('invoice_items',{name:'Work',invoice_id:invoice,quantity:'1.000',unit_price:'10000.000',discount:'0',tax:'0'});
 assert.equal((await db.query<{total:string}>('select total::text from public.invoices where id=$1',[invoice])).rows[0].total,'10000.000');
 await assert.rejects(()=>save('invoices',{name:'Tamper',total:'1'},invoice),/server managed/);
 await db.query("select public.am_invoice_stage($1,'Issued')",[invoice]);
 async function pay(amount:string,request:string){return (await db.query<{id:string}>('select public.am_payment_record($1,$2::jsonb,$3) id',[invoice,JSON.stringify({amount,payment_date:'2026-01-05',method:'Bank Transfer'}),request])).rows[0].id;}
 const payment=await pay('4000.000',id(50));assert.equal(await pay('4000.000',id(50)),payment);
 let row=(await db.query<{paid:string;balance:string;status:string}>('select paid_amount::text paid,balance::text balance,status from public.invoices where id=$1',[invoice])).rows[0];assert.equal(row.paid,'4000.000');assert.equal(row.balance,'6000.000');assert.equal(row.status,'Overdue');
 await assert.rejects(()=>pay('6000.001',id(51)),/balance|exceed/i);
 await pay('6000.000',id(52));row=(await db.query<typeof row>('select paid_amount::text paid,balance::text balance,status from public.invoices where id=$1',[invoice])).rows[0];assert.equal(row.balance,'0.000');assert.equal(row.status,'Paid');
 await assert.rejects(()=>db.query("select public.am_invoice_stage($1,'Cancelled','Mistake')",[invoice]),/reversal/);
 await db.query("select public.am_payment_adjust($1,'{}',true,'Bank transfer reversed')",[payment]);
 assert.equal((await db.query<{balance:string}>('select balance::text from public.invoices where id=$1',[invoice])).rows[0].balance,'4000.000');
 await login('owner_director');assert.equal((await db.query('select * from public.invoices')).rows.length,1);await assert.rejects(()=>save('invoices',{name:'No',customer_id:customer,invoice_date:'2026-01-01',due_date:'2026-02-01'}),/permission/);assert.equal((await db.query('select * from public.approval_rules')).rows.length,0);
 const overview=(await db.query<{data:{outstanding:string;collected:string;overdue_invoices:string;aging:{amount:string}[]}}>('select public.am_financial_overview() data')).rows[0].data;assert.equal(overview.outstanding,'4000.000');assert.equal(overview.collected,'6000.000');assert.equal(overview.overdue_invoices,'1');assert.ok(overview.aging.some(a=>a.amount==='4000.000'));
 await login('engineer');for(const table of ['invoices','invoice_items','payments','receivables','project_financials','project_variations','amc_financials','service_charges','cost_records','financial_audit']) assert.equal((await db.query(`select * from public.${table}`)).rows.length,0,table);
 await assert.rejects(()=>db.query("select public.am_finance_read('invoices')"),/permission/);
 await assert.rejects(()=>pay('1.000',id(53)),/permission/);
 await login('project_manager');assert.equal((await db.query('select * from public.project_financials')).rows.length,0);
 await login('super_admin');await db.query('select public.am_project_finance_grant($1,$2,true,true,false)',[project,id(16)]);
 await login('project_manager');assert.equal((await db.query('select * from public.project_financials')).rows.length,1);await save('cost_records',{name:'Labour',project_id:project,customer_id:customer,cost_type:'Labour',quantity:'8.000',unit_cost:'12.500'});await assert.rejects(()=>pay('1',id(54)),/permission/);
 await login('super_admin');const audit=(await db.query<{action:string}>('select action from public.financial_audit')).rows;assert.ok(audit.some(r=>r.action.includes('Payment')));assert.ok(audit.length>8);
 // JS preview and authoritative SQL agree at baisa rounding boundaries.
 for(const item of [{quantity:'2.345',unit_price:'123.456',discount:'12.3456',tax:'5.0000'},{quantity:'1',unit_price:'0.010',discount:'5',tax:'5'}]){const line=(await db.query<{values:string[]}>('select ARRAY(select x::text from unnest(public.am_money_line($1,$2,$3,$4)) x) values',[item.quantity,item.unit_price,item.discount,item.tax])).rows[0].values;assert.equal(calculateTotals([item]).total,line[4]);}
 assert.equal(formatMoney('123456789012345.678'),'OMR 123,456,789,012,345.678');
 }finally{await db.close();}
});
