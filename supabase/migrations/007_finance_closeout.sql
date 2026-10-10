begin;

-- Source identity remains immutable after issue, including its discriminator.
create function public.am_lock_invoice_source() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status<>'Draft' and new.source_type is distinct from old.source_type then
  raise exception 'Issued invoice source is locked.';
 end if;
 return new;
end$$;
create trigger invoice_source_identity before update on public.invoices for each row execute function public.am_lock_invoice_source();

-- RLS is inherited from both payment and invoice. No description-text inference.
-- AMC contract invoices and covered AMC work are excluded. Warranty extras require
-- an explicitly authorized positive service charge; normal Paid Service needs none.
create view public.paid_service_collections with(security_invoker=true) as
 select p.* from public.payments p
 join public.invoices i on i.id=p.invoice_id and i.tenant_id=p.tenant_id
 where p.status='Recorded' and i.status not in ('Draft','Cancelled') and i.source_type='Service'
 and (public.am_service_classification(i.work_order_id)='Paid Service'
  or (public.am_service_classification(i.work_order_id)='Warranty Service'
   and exists(select 1 from public.service_charges s where s.work_order_id=i.work_order_id
    and s.tenant_id=i.tenant_id and s.status in ('Approved','Invoiced') and s.total>0
    and s.approved_by is not null and nullif(trim(s.extra_charge_reason),'') is not null)));
grant select on public.paid_service_collections to authenticated,service_role;

create or replace function public.am_finance_read(entity text,filters jsonb default '{}',page integer default 1,size integer default 20,target uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare condition text:='true'; key text; result jsonb; amount bigint; status_expr text:='r.status';
begin
 if not entity=any(array['quotations','quotation_items','project_financials','project_variations','project_financial_summary','amc_financials','amc_financial_summary','invoices','invoice_items','payments','receivables','service_charges','work_order_part_financials','cost_records','financial_audit']) then raise exception 'Invalid finance module.'; end if;
 if not public.am_allowed(case entity when 'project_financial_summary' then 'project_financials' when 'amc_financial_summary' then 'amc_financials' else entity end) then raise exception 'Financial read permission required.'; end if;
 if entity in ('invoices','receivables') then status_expr:='public.am_invoice_state(r.status,r.total,r.paid_amount,r.due_date)'; end if;
 if target is not null then condition:=condition||format(' and r.id=%L::uuid',target); end if;
 for key in select jsonb_object_keys(filters) loop
  if nullif(filters->>key,'') is null then continue; end if;
  if key='q' then condition:=condition||format(' and (r.name ilike %L or r.code ilike %L)','%'||left(filters->>key,100)||'%','%'||left(filters->>key,100)||'%');
  elsif key='status' then condition:=condition||format(' and %s=%L',status_expr,filters->>key);
  elsif key='source_type' and entity='invoices' then condition:=condition||format(' and r.source_type=%L',filters->>key);
  elsif key='paid_service' and entity='payments' and filters->>key='true' then condition:=condition||' and exists(select 1 from public.paid_service_collections s where s.id=r.id)';
  elsif key=any(array['customer_id','project_id','amc_id','work_order_id','invoice_id','quotation_id','part_id','entity_id']) then condition:=condition||format(' and r.%I=%L::uuid',key,filters->>key);
  elsif key in ('due_from','due_to') and entity in ('invoices','receivables') then condition:=condition||format(' and r.due_date %s %L::date',case key when 'due_from' then '>=' else '<=' end,filters->>key);
  elsif key='overdue' and entity in ('invoices','receivables') then condition:=condition||' and r.balance>0 and r.due_date<public.am_today() and r.status not in (''Draft'',''Cancelled'')';
  else raise exception 'Invalid finance filter.'; end if;
 end loop;
 execute format('select count(*) from public.%I r where %s',entity,condition) into amount;
 execute format('select coalesce(jsonb_agg(public.am_money_json(to_jsonb(x))),''[]'') from (select r.*%s from public.%I r where %s order by r.created_at desc,r.id limit $1 offset $2) x',case when entity='invoices' then ', public.am_invoice_state(r.status,r.total,r.paid_amount,r.due_date) effective_status' else '' end,entity,condition) into result using least(greatest(size,1),500),(greatest(page,1)-1)*least(greatest(size,1),500);
 return jsonb_build_object('records',result,'count',amount);
end$$;

-- One database aggregate for the complete filtered report. Only the current page
-- is serialized to the app; totals never depend on a 10,000-row client cutoff.
create function public.am_financial_report(report_key text,customer uuid default null,page integer default 1,size integer default 20) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare entity text; amount_column text; group_column text; source text; condition text:='true'; eligible text:='true'; label text; filters jsonb:='{}'; result jsonb; summary jsonb;
begin
 select v.entity,v.amount_column,v.group_column into entity,amount_column,group_column from (values
 ('financial-pipeline','quotations','grand_total','status'),
 ('quotation-summary','quotations','grand_total','status'),
 ('quotation-conversion','quotations','grand_total','status'),
 ('project-financial-summary','project_financial_summary','project_revenue','project_status'),
 ('invoices','invoices','total','status'),
 ('outstanding-receivables','receivables','balance','customer_id'),
 ('payment-history','payments','amount','method'),
 ('receivables-aging','receivables','balance','aging_bucket'),
 ('amc-contract-value','amc_financial_summary','contract_value','contract_status'),
 ('amc-renewals','amc_financial_summary','renewal_value','end_date'),
 ('paid-service-revenue','payments','amount','payment_date'),
 ('project-cost-summary','cost_records','total_cost','cost_type'),
 ('project-profitability','project_financial_summary','gross_profit','project_status'),
 ('customer-financial-history','invoices','total','customer_id')
 ) v(key,entity,amount_column,group_column) where v.key=report_key;
 if entity is null then raise exception 'Invalid financial report.'; end if;
 if customer is not null then
  filters:=jsonb_build_object('customer_id',customer); condition:=format('r.customer_id=%L::uuid',customer);
 end if;
 source:=entity;
 if report_key='paid-service-revenue' then
  source:='paid_service_collections'; filters:=filters||'{"paid_service":"true","status":"Recorded"}'::jsonb;
 elsif entity='payments' then eligible:='r.status=''Recorded''';
 elsif entity='invoices' then eligible:='r.status not in (''Draft'',''Cancelled'')';
 end if;
 result:=public.am_finance_read(entity,filters,page,least(size,100));
 label:=format('coalesce(r.%I::text,''Not recorded'')',group_column);
 if group_column='customer_id' then label:='coalesce(c.name,''Customer'')';
 elsif group_column in ('invoice_date','payment_date','end_date') then label:=format('coalesce(to_char(r.%I,''YYYY-MM''),''Not recorded'')',group_column);
 elsif entity='invoices' and group_column='status' then label:='public.am_invoice_state(r.status,r.total,r.paid_amount,r.due_date)'; end if;
 execute format('with matching as materialized (
  select r.%I amount,r.status,%s eligible,%s label from public.%I r %s where %s
 ), grouped as (
  select label,sum(amount) value,count(*) count from matching where eligible and amount is not null group by label
 ) select jsonb_build_object(''total'',coalesce((select sum(amount) from matching where eligible),0)::numeric(18,3)::text,
  ''excluded_count'',(select count(*) from matching where not eligible),
  ''approved_count'',(select count(*) from matching where status=''Approved''),
  ''groups'',coalesce((select jsonb_agg(jsonb_build_object(''label'',label,''value'',value::numeric(18,3)::text,''count'',count) order by label) from grouped),''[]''))',
 amount_column,eligible,label,source,case when group_column='customer_id' then 'left join public.customers c on c.id=r.customer_id and c.tenant_id=r.tenant_id' else '' end,condition) into summary;
 return result||jsonb_build_object('summary',summary);
end$$;
revoke all on function public.am_financial_report(text,uuid,integer,integer) from public,anon;
grant execute on function public.am_financial_report(text,uuid,integer,integer) to authenticated,service_role;

-- Combine per-parent rollups instead of scanning the same invoices three times.
create or replace view public.project_financial_summary with(security_invoker=true) as
 with financial_values as (
 select f.*,p.status project_status,p.target_date,p.quotation_id,q.grand_total quoted_value,
 coalesce(v.variation_value,0) variation_value,coalesce(v.approved_variation_value,0) approved_variation_value,
 coalesce(i.invoiced_amount,0) invoiced_amount,coalesce(i.paid_amount,0) paid_amount,coalesce(i.outstanding_amount,0) outstanding_amount,
 coalesce(f.actual_cost_override,c.actual_cost) actual_cost
 from public.project_financials f join public.projects p on p.id=f.project_id left join public.quotations q on q.id=p.quotation_id
 left join lateral(select sum(amount) variation_value,sum(amount) filter(where status='Approved') approved_variation_value from public.project_variations where project_id=f.project_id) v on true
 left join lateral(select sum(total) invoiced_amount,sum(paid_amount) paid_amount,sum(balance) outstanding_amount from public.invoices where project_id=f.project_id and status not in ('Draft','Cancelled')) i on true
 left join lateral(select sum(total_cost) actual_cost from public.cost_records where project_id=f.project_id) c on true
 ), totals as(select *,base_value+approved_variation_value project_revenue from financial_values)
 select *,case when recognized_revenue is not null and actual_cost is not null then recognized_revenue-actual_cost end gross_profit,
 case when recognized_revenue>0 and actual_cost is not null then round((recognized_revenue-actual_cost)/recognized_revenue*100,3) end gross_margin_percent from totals;

create or replace view public.amc_financial_summary with(security_invoker=true) as
 select f.*,a.start_date,a.end_date,a.status contract_status,
 coalesce(i.amount_billed,0) amount_billed,coalesce(i.amount_paid,0) amount_paid,coalesce(i.outstanding,0) outstanding
 from public.amc_financials f join public.amc_contracts a on a.id=f.amc_id
 left join lateral(select sum(total) amount_billed,sum(paid_amount) amount_paid,sum(balance) outstanding from public.invoices where amc_id=f.amc_id and status not in ('Draft','Cancelled')) i on true;

-- Aggregate invoices/payments once per overview instead of repeating each sum
-- for every month, balance KPI and aging bucket.
create or replace function public.am_financial_overview(customer uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if public.am_role() not in ('owner_director','super_admin','management','accounts_finance','sales_admin') or (public.am_role()='sales_admin' and customer is null) then raise exception 'Company finance permission required.'; end if;
 with inv as materialized (
  select total,balance,invoice_date,due_date,
   case when due_date>=public.am_today() then 'Current' when public.am_today()-due_date<=30 then '1–30 Days'
    when public.am_today()-due_date<=60 then '31–60 Days' when public.am_today()-due_date<=90 then '61–90 Days' else '90+ Days' end bucket
  from public.invoices where status not in ('Draft','Cancelled') and (customer is null or customer_id=customer)
 ), pay as materialized (
  select p.amount,p.payment_date from public.payments p join public.invoices i on i.id=p.invoice_id and i.tenant_id=p.tenant_id
  where p.status='Recorded' and i.status not in ('Draft','Cancelled') and (customer is null or p.customer_id=customer)
 ), invoice_totals as (
  select coalesce(sum(total),0) invoiced,coalesce(sum(balance) filter(where balance>0),0) outstanding,
   coalesce(sum(balance) filter(where balance>0 and due_date<public.am_today()),0) overdue_amount,
   count(*) filter(where balance>0 and due_date<public.am_today()) overdue_invoices,
   count(*) filter(where balance>0 and due_date<=public.am_today()+30) invoices_due from inv
 ), payment_totals as (
  select coalesce(sum(amount),0) collected,coalesce(sum(amount) filter(where payment_date>=date_trunc('month',public.am_today())::date),0) month_payments from pay
 ), quotes as (
  select coalesce(sum(grand_total),0) total_quoted,
   coalesce(sum(grand_total) filter(where status not in ('Approved','Rejected','Expired')),0) pipeline,
   coalesce(sum(grand_total) filter(where status='Approved'),0) approved_value,
   case when count(*)>0 then round(count(*) filter(where status='Approved')::numeric/count(*)*100,1) end conversion
  from public.quotations where customer is null or customer_id=customer
 ), invoice_months as (
  select to_char(invoice_date,'YYYY-MM') as "month",sum(total) invoiced from inv
   where invoice_date>=date_trunc('month',public.am_today())-interval '5 months' group by 1
 ), payment_months as (
  select to_char(payment_date,'YYYY-MM') as "month",sum(amount) collected from pay
   where payment_date>=date_trunc('month',public.am_today())-interval '5 months' group by 1
 ), trend as (
  select to_char(m,'YYYY-MM') as "month",coalesce(i.invoiced,0) invoiced,coalesce(p.collected,0) collected
  from generate_series(date_trunc('month',public.am_today())-interval '5 months',date_trunc('month',public.am_today()),interval '1 month') m
  left join invoice_months i on i."month"=to_char(m,'YYYY-MM') left join payment_months p on p."month"=to_char(m,'YYYY-MM')
 ), aging_values as (
  select bucket,count(*) invoice_count,sum(balance) amount from inv where balance>0 group by bucket
 ), aging as (
  select b.label bucket,b.position,coalesce(a.invoice_count,0) invoice_count,coalesce(a.amount,0) amount
  from (values('Current',1),('1–30 Days',2),('31–60 Days',3),('61–90 Days',4),('90+ Days',5)) b(label,position)
  left join aging_values a on a.bucket=b.label
 ) select public.am_money_json(jsonb_build_object(
  'customers',(select count(*) from public.customers where customer is null or id=customer),
  'open_enquiries',(select count(*) from public.enquiries where status not in ('Won','Lost','Closed') and (customer is null or customer_id=customer)),
  'active_projects',(select count(*) from public.projects where status='Active' and (customer is null or customer_id=customer)),
  'open_cases',(select count(*) from public.complaints where status not in ('Resolved','Closed') and (customer is null or customer_id=customer)),
  'active_project_value',(select coalesce(sum(project_revenue),0) from public.project_financial_summary where project_status='Active' and (customer is null or customer_id=customer)),
  'amc_contracts',(select count(*) from public.amc_contracts where status in ('Active','Expiring') and end_date>=public.am_today() and (customer is null or customer_id=customer)),
  'amc_value',(select coalesce(sum(contract_value),0) from public.amc_financial_summary where contract_status in ('Active','Expiring') and end_date>=public.am_today() and (customer is null or customer_id=customer)),
  'amc_expiring',(select count(*) from public.amc_contracts where status in ('Active','Expiring') and end_date between public.am_today() and public.am_today()+30 and (customer is null or customer_id=customer))
 )||to_jsonb(i)||to_jsonb(p)||to_jsonb(q))||jsonb_build_object(
  'trend',(select jsonb_agg(public.am_money_json(to_jsonb(t)) order by t."month") from trend t),
  'aging',(select jsonb_agg(public.am_money_json(to_jsonb(a)) order by a.position) from aging a)
 ) into result from invoice_totals i cross join payment_totals p cross join quotes q;
 return result;
end$$;

commit;
