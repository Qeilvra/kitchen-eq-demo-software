begin;

-- Additive commercial/billing layer. Operational records retain their existing routes.
alter table public.roles drop constraint roles_name_check;
alter table public.roles add constraint roles_name_check check(name in ('owner_director','super_admin','management','sales_admin','accounts_finance','service_manager','project_manager','engineer'));
insert into public.roles(name) values ('owner_director'),('accounts_finance'),('project_manager');

create table public.project_finance_access (
 tenant_id uuid not null references public.tenants(id), profile_id uuid not null, project_id uuid not null,
 can_view boolean not null default false, can_record_costs boolean not null default false, can_approve boolean not null default false,
 primary key(profile_id,project_id), foreign key(profile_id,tenant_id) references public.profiles(id,tenant_id), foreign key(project_id,tenant_id) references public.projects(id,tenant_id)
);
create table public.approval_rules (
 tenant_id uuid not null references public.tenants(id), action text not null check(action in ('quotation_approval','discount_approval','variation_approval','invoice_issue','invoice_cancellation','service_charge_approval','service_extra_charge')),
 role text not null references public.roles(name), enabled boolean not null default false,
 max_amount numeric(18,3) check(max_amount between 0 and 999999999999999.999), primary key(tenant_id,action,role)
);
create table public.financial_document_counters (
 tenant_id uuid not null references public.tenants(id), prefix text not null, year integer not null, next_number bigint not null default 1, primary key(tenant_id,prefix,year)
);
create function public.am_seed_approval_rules(tenant uuid) returns void language sql security definer set search_path='' as $$
 insert into public.approval_rules(tenant_id,action,role,enabled)
 select tenant,a,r,case when r='super_admin' then true
  when r='management' then a=any(array['quotation_approval','discount_approval','variation_approval','invoice_issue','invoice_cancellation','service_charge_approval','service_extra_charge'])
  when r='sales_admin' then a=any(array['quotation_approval','discount_approval'])
  when r='accounts_finance' then a=any(array['discount_approval','invoice_issue','service_charge_approval'])
  when r='service_manager' then a=any(array['service_charge_approval','service_extra_charge']) else false end
 from unnest(array['quotation_approval','discount_approval','variation_approval','invoice_issue','invoice_cancellation','service_charge_approval','service_extra_charge']) a
 cross join unnest(array['owner_director','super_admin','management','sales_admin','accounts_finance','service_manager','project_manager']) r
 on conflict do nothing
$$;
select public.am_seed_approval_rules(id) from public.tenants;
create function public.am_tenant_finance_defaults() returns trigger language plpgsql security definer set search_path='' as $$begin perform public.am_seed_approval_rules(new.id); return new; end$$;
create trigger tenant_financial_defaults after insert on public.tenants for each row execute function public.am_tenant_finance_defaults();

create function public.am_project_finance_scope(project uuid, writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select case when public.am_role() in ('owner_director','super_admin','management','accounts_finance','sales_admin') then not writing or public.am_role() in ('super_admin','management','accounts_finance')
 when public.am_role()='project_manager' then exists(select 1 from public.projects p join public.project_finance_access g on g.project_id=p.id and g.profile_id=auth.uid() where p.id=project and p.tenant_id=public.am_tenant() and p.manager_id=auth.uid() and g.can_view and (not writing or g.can_record_costs)) else false end
$$;
create function public.am_finance_allowed(entity text, writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select case public.am_role()
 when 'super_admin' then true
 when 'owner_director' then not writing
 when 'accounts_finance' then entity<>'financial_audit' or not writing
 when 'management' then not writing or entity=any(array['project_financials','project_variations','amc_financials','service_charges','work_order_part_financials','cost_records'])
 when 'sales_admin' then not writing and entity<>all(array['cost_records','work_order_part_financials','financial_audit'])
 when 'service_manager' then entity=any(array['service_charges','work_order_part_financials','cost_records'])
 when 'project_manager' then entity=any(array['project_financials','project_variations','cost_records','invoices','invoice_items','payments','receivables']) and (not writing or entity=any(array['project_variations','cost_records']))
 else false end
$$;
create or replace function public.am_allowed(entity text, writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select case
 when entity=any(array['approval_rules','project_finance_access','profiles_admin']) then public.am_role()='super_admin'
 when entity=any(array['invoices','invoice_items','payments','receivables','project_financials','project_variations','amc_financials','service_charges','work_order_part_financials','cost_records','financial_audit']) then public.am_finance_allowed(entity,writing)
 else case public.am_role()
 when 'super_admin' then true
 when 'owner_director' then not writing
 when 'management' then not writing or entity<>'engineers'
 when 'sales_admin' then entity=any(array['customers','contacts','sites','enquiries','enquiry_activities','quotations','quotation_items','quotation_followups','projects','project_engineers','documents','notifications','activity_log'])
 when 'accounts_finance' then not writing and entity=any(array['customers','contacts','sites','quotations','quotation_items','projects','amc_contracts','work_orders','service_reports','documents','activity_log','notifications'])
 when 'project_manager' then entity=any(array['customers','contacts','sites','projects','project_engineers','equipment','work_orders','service_reports','documents','activity_log','notifications']) and (not writing or entity=any(array['projects','project_engineers','documents']))
 when 'service_manager' then entity=any(array['customers','contacts','sites','equipment','complaints','engineers','work_orders','work_order_readings','work_order_parts','work_order_activities','amc_contracts','amc_equipment','pm_schedules','pm_visits','service_reports','documents','notifications','activity_log'])
 when 'engineer' then case when writing then entity=any(array['work_order_readings','work_order_parts','documents']) else entity=any(array['customers','contacts','sites','equipment','complaints','work_orders','work_order_readings','work_order_parts','work_order_activities','service_reports','documents','notifications','activity_log']) end else false end end
$$;
create function public.am_can_approve(action text, amount numeric default 0, project uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select public.am_role()<>'engineer' and exists(select 1 from public.approval_rules a where a.tenant_id=public.am_tenant() and a.action=action and a.role=public.am_role() and a.enabled and (a.max_amount is null or amount<=a.max_amount))
 and (public.am_role()<>'project_manager' or exists(select 1 from public.project_finance_access g join public.projects p on p.id=g.project_id where g.project_id=project and g.profile_id=auth.uid() and g.can_view and g.can_approve and p.manager_id=auth.uid() and p.tenant_id=public.am_tenant()))
$$;

-- Exact line engine shared by quotation and invoice generated columns.
create function public.am_money_line(quantity numeric,price numeric,discount numeric,tax numeric) returns numeric[] language sql immutable set search_path='' as $$
 with a as (select round(quantity*price,3) subtotal), b as (select subtotal,round(subtotal*discount/100,3) reduction from a), c as (select subtotal,reduction,subtotal-reduction taxable from b), d as(select *,round(taxable*tax/100,3) tax_amount from c)
 select array[subtotal,reduction,taxable,tax_amount,taxable+tax_amount] from d
$$;
alter table public.quotation_items alter column unit_price type numeric(18,3), alter column discount type numeric(7,4), alter column tax type numeric(7,4);
alter table public.quotation_items add constraint quotation_price_finite check(unit_price between 0 and 999999999999999.999), add constraint quotation_quantity_finite check(quantity between .001 and 999999999.999);
alter table public.quotation_items
 add column line_subtotal numeric(18,3) generated always as ((public.am_money_line(quantity,unit_price,discount,tax))[1]) stored,
 add column discount_amount numeric(18,3) generated always as ((public.am_money_line(quantity,unit_price,discount,tax))[2]) stored,
 add column taxable_amount numeric(18,3) generated always as ((public.am_money_line(quantity,unit_price,discount,tax))[3]) stored,
 add column tax_amount numeric(18,3) generated always as ((public.am_money_line(quantity,unit_price,discount,tax))[4]) stored,
 add column line_total numeric(18,3) generated always as ((public.am_money_line(quantity,unit_price,discount,tax))[5]) stored;
alter table public.quotations add column currency text not null default 'OMR' check(currency='OMR'), add column subtotal numeric(18,3) not null default 0, add column discount_amount numeric(18,3) not null default 0, add column taxable_amount numeric(18,3) not null default 0, add column tax_amount numeric(18,3) not null default 0, add column grand_total numeric(18,3) not null default 0;

alter table public.work_orders add column project_id uuid, add constraint work_order_project_tenant foreign key(project_id,tenant_id) references public.projects(id,tenant_id);
create index work_order_project_idx on public.work_orders(project_id);
update public.work_orders w set project_id=e.project_id from public.equipment e where e.id=w.equipment_id and e.tenant_id=w.tenant_id and e.project_id is not null;

create table public.project_financials (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),code text not null default '',name text not null,status text not null default 'Recorded',created_at timestamptz not null default now(),
 project_id uuid not null unique,customer_id uuid not null,base_value numeric(18,3) check(base_value between 0 and 999999999999999.999),estimated_cost numeric(18,3) check(estimated_cost between 0 and 999999999999999.999),actual_cost_override numeric(18,3) check(actual_cost_override between 0 and 999999999999999.999),recognized_revenue numeric(18,3) check(recognized_revenue between 0 and 999999999999999.999),notes text,
 unique(id,tenant_id),unique(tenant_id,code),foreign key(project_id,tenant_id) references public.projects(id,tenant_id),foreign key(customer_id,tenant_id) references public.customers(id,tenant_id)
);
create table public.project_variations (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),code text not null default '',name text not null,status text not null default 'Draft' check(status in ('Draft','Submitted','Approved','Rejected')),created_at timestamptz not null default now(),
 project_id uuid not null,customer_id uuid not null,variation_date date not null default public.am_today(),amount numeric(18,3) not null check(amount between 0 and 999999999999999.999),approved_at timestamptz,approved_by uuid,notes text,
 unique(id,tenant_id),unique(tenant_id,code),foreign key(project_id,tenant_id) references public.projects(id,tenant_id),foreign key(customer_id,tenant_id) references public.customers(id,tenant_id),foreign key(approved_by,tenant_id) references public.profiles(id,tenant_id)
);
create table public.amc_financials (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),code text not null default '',name text not null,status text not null default 'Recorded',created_at timestamptz not null default now(),
 amc_id uuid not null unique,customer_id uuid not null,contract_value numeric(18,3) check(contract_value between 0 and 999999999999999.999),billing_frequency text not null default 'Custom' check(billing_frequency in ('Monthly','Quarterly','Semi-Annual','Annual','Custom')),renewal_value numeric(18,3) check(renewal_value between 0 and 999999999999999.999),notes text,
 unique(id,tenant_id),unique(tenant_id,code),foreign key(amc_id,tenant_id) references public.amc_contracts(id,tenant_id),foreign key(customer_id,tenant_id) references public.customers(id,tenant_id)
);
create table public.invoices (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),code text not null default '',name text not null,status text not null default 'Draft' check(status in ('Draft','Issued','Partially Paid','Paid','Overdue','Cancelled')),created_at timestamptz not null default now(),
 customer_id uuid not null,source_type text not null default 'General' check(source_type in ('General','Project','AMC','Service')),project_id uuid,amc_id uuid,work_order_id uuid,invoice_date date not null default public.am_today(),due_date date not null,currency text not null default 'OMR' check(currency='OMR'),
 subtotal numeric(18,3) not null default 0,discount_amount numeric(18,3) not null default 0,taxable_amount numeric(18,3) not null default 0,tax_amount numeric(18,3) not null default 0,total numeric(18,3) not null default 0,paid_amount numeric(18,3) not null default 0,
 balance numeric(18,3) generated always as(case when status='Cancelled' then 0 else total-paid_amount end) stored,issued_at timestamptz,issued_by uuid,cancelled_at timestamptz,cancelled_by uuid,cancellation_reason text,notes text,
 check(due_date>=invoice_date),check(total>=paid_amount and paid_amount>=0),unique(id,tenant_id),unique(tenant_id,code),foreign key(customer_id,tenant_id) references public.customers(id,tenant_id),foreign key(project_id,tenant_id) references public.projects(id,tenant_id),foreign key(amc_id,tenant_id) references public.amc_contracts(id,tenant_id),foreign key(work_order_id,tenant_id) references public.work_orders(id,tenant_id),foreign key(issued_by,tenant_id) references public.profiles(id,tenant_id),foreign key(cancelled_by,tenant_id) references public.profiles(id,tenant_id)
);
create unique index one_live_service_invoice on public.invoices(work_order_id) where work_order_id is not null and status<>'Cancelled';
create table public.invoice_items (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),code text not null default '',name text not null,status text not null default 'Active',created_at timestamptz not null default now(),invoice_id uuid not null,
 quantity numeric(12,3) not null default 1 check(quantity between .001 and 999999999.999),unit text not null default 'Each',unit_price numeric(18,3) not null default 0 check(unit_price between 0 and 999999999999999.999),discount numeric(7,4) not null default 0 check(discount between 0 and 100),tax numeric(7,4) not null default 5 check(tax between 0 and 100),
 line_subtotal numeric(18,3) generated always as ((public.am_money_line(quantity,unit_price,discount,tax))[1]) stored,
 discount_amount numeric(18,3) generated always as ((public.am_money_line(quantity,unit_price,discount,tax))[2]) stored,
 taxable_amount numeric(18,3) generated always as ((public.am_money_line(quantity,unit_price,discount,tax))[3]) stored,
 tax_amount numeric(18,3) generated always as ((public.am_money_line(quantity,unit_price,discount,tax))[4]) stored,
 line_total numeric(18,3) generated always as ((public.am_money_line(quantity,unit_price,discount,tax))[5]) stored,
 unique(id,tenant_id),unique(tenant_id,code),foreign key(invoice_id,tenant_id) references public.invoices(id,tenant_id)
);
create table public.payments (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),code text not null default '',name text not null,status text not null default 'Recorded' check(status in ('Recorded','Reversed')),created_at timestamptz not null default now(),
 invoice_id uuid not null,customer_id uuid not null,payment_date date not null default public.am_today(),amount numeric(18,3) not null check(amount between .001 and 999999999999999.999),method text not null check(method in ('Bank Transfer','Cheque','Cash','Card','Other')),transaction_reference text,notes text,recorded_by uuid,reversed_by uuid,reversed_at timestamptz,reversal_reason text,
 request_id uuid not null,request_fingerprint text not null,unique(tenant_id,request_id),unique(id,tenant_id),unique(tenant_id,code),foreign key(invoice_id,tenant_id) references public.invoices(id,tenant_id),foreign key(customer_id,tenant_id) references public.customers(id,tenant_id),foreign key(recorded_by,tenant_id) references public.profiles(id,tenant_id),foreign key(reversed_by,tenant_id) references public.profiles(id,tenant_id)
);
create table public.service_charges (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),code text not null default '',name text not null,status text not null default 'Draft' check(status in ('Draft','Approved','Invoiced')),created_at timestamptz not null default now(),work_order_id uuid not null unique,customer_id uuid not null,project_id uuid,
 inspection_fee numeric(18,3) not null default 0 check(inspection_fee between 0 and 999999999999999.999),labour_charge numeric(18,3) not null default 0 check(labour_charge between 0 and 999999999999999.999),parts_charge numeric(18,3) not null default 0 check(parts_charge between 0 and 999999999999999.999),recorded_parts_charge numeric(18,3) not null default 0,other_charges numeric(18,3) not null default 0 check(other_charges between 0 and 999999999999999.999),discount numeric(7,4) not null default 0 check(discount between 0 and 100),tax numeric(7,4) not null default 5 check(tax between 0 and 100),
 subtotal numeric(18,3) generated always as(inspection_fee+labour_charge+parts_charge+recorded_parts_charge+other_charges) stored,
 discount_amount numeric(18,3) generated always as((public.am_money_line(1,inspection_fee+labour_charge+parts_charge+recorded_parts_charge+other_charges,discount,tax))[2]) stored,
 tax_amount numeric(18,3) generated always as((public.am_money_line(1,inspection_fee+labour_charge+parts_charge+recorded_parts_charge+other_charges,discount,tax))[4]) stored,
 total numeric(18,3) generated always as((public.am_money_line(1,inspection_fee+labour_charge+parts_charge+recorded_parts_charge+other_charges,discount,tax))[5]) stored,
 extra_charge_reason text,approved_by uuid,approved_at timestamptz,notes text,unique(id,tenant_id),unique(tenant_id,code),foreign key(work_order_id,tenant_id) references public.work_orders(id,tenant_id),foreign key(customer_id,tenant_id) references public.customers(id,tenant_id),foreign key(project_id,tenant_id) references public.projects(id,tenant_id),foreign key(approved_by,tenant_id) references public.profiles(id,tenant_id)
);
create table public.work_order_part_financials (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),code text not null default '',name text not null,status text not null default 'Recorded',created_at timestamptz not null default now(),part_id uuid not null unique,work_order_id uuid not null,customer_id uuid not null,project_id uuid,
 unit_cost numeric(18,3) not null default 0 check(unit_cost between 0 and 999999999999999.999),unit_sell_price numeric(18,3) not null default 0 check(unit_sell_price between 0 and 999999999999999.999),chargeable boolean not null default false,notes text,
 unique(id,tenant_id),unique(tenant_id,code),foreign key(part_id,tenant_id) references public.work_order_parts(id,tenant_id),foreign key(work_order_id,tenant_id) references public.work_orders(id,tenant_id),foreign key(customer_id,tenant_id) references public.customers(id,tenant_id),foreign key(project_id,tenant_id) references public.projects(id,tenant_id)
);
create table public.cost_records (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),code text not null default '',name text not null,status text not null default 'Recorded',created_at timestamptz not null default now(),customer_id uuid not null,project_id uuid,work_order_id uuid,source_part_id uuid unique,
 cost_type text not null check(cost_type in ('Materials','Labour','Subcontractor','Transport','Equipment','Other')),cost_date date not null default public.am_today(),supplier text,quantity numeric(12,3) not null default 1 check(quantity between .001 and 999999999.999),unit_cost numeric(18,3) not null check(unit_cost between 0 and 999999999999999.999),
 total_cost numeric(18,3) generated always as(round(quantity*unit_cost,3)) stored,notes text,recorded_by uuid,check(project_id is not null or work_order_id is not null),
 unique(id,tenant_id),unique(tenant_id,code),foreign key(customer_id,tenant_id) references public.customers(id,tenant_id),foreign key(project_id,tenant_id) references public.projects(id,tenant_id),foreign key(work_order_id,tenant_id) references public.work_orders(id,tenant_id),foreign key(source_part_id,tenant_id) references public.work_order_parts(id,tenant_id),foreign key(recorded_by,tenant_id) references public.profiles(id,tenant_id)
);
create table public.financial_audit (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),created_at timestamptz not null default now(),actor_id uuid,action text not null,entity_type text not null,entity_id uuid not null,customer_id uuid,project_id uuid,work_order_id uuid,before_data jsonb,after_data jsonb,reason text,
 foreign key(actor_id,tenant_id) references public.profiles(id,tenant_id),foreign key(customer_id,tenant_id) references public.customers(id,tenant_id),foreign key(project_id,tenant_id) references public.projects(id,tenant_id),foreign key(work_order_id,tenant_id) references public.work_orders(id,tenant_id)
);

create index invoice_customer_idx on public.invoices(tenant_id,customer_id);
create index invoice_project_idx on public.invoices(project_id);
create index invoice_due_idx on public.invoices(tenant_id,due_date,status);
create index invoice_amc_idx on public.invoices(amc_id);
create index invoice_item_parent_idx on public.invoice_items(invoice_id);
create index payment_invoice_idx on public.payments(invoice_id,status);
create index payment_date_idx on public.payments(tenant_id,payment_date);
create index payment_customer_idx on public.payments(customer_id);
create index variation_project_idx on public.project_variations(project_id,status);
create index cost_project_idx on public.cost_records(project_id);
create index cost_work_idx on public.cost_records(work_order_id);
create index financial_audit_record_idx on public.financial_audit(tenant_id,entity_type,entity_id,created_at desc);

-- Numeric JSON is deliberately emitted as text, preserving baisa and large values.
create function public.am_money_json(data jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(key,case when jsonb_typeof(value)='number' then to_jsonb(value::text) else value end),'{}'::jsonb) from jsonb_each(data)
$$;
create function public.am_finance_code() returns trigger language plpgsql security definer set search_path='' as $$
declare code_prefix text; n bigint; y integer:=extract(year from public.am_today());
begin
 if new.code='' then
  code_prefix:=case tg_table_name when 'invoices' then 'INV' when 'payments' then 'PAY' when 'project_variations' then 'VAR' when 'cost_records' then 'COST' when 'project_financials' then 'PF' when 'amc_financials' then 'AF' when 'service_charges' then 'SC' else 'PARTF' end;
  insert into public.financial_document_counters(tenant_id,prefix,year,next_number) values(new.tenant_id,code_prefix,y,1) on conflict(tenant_id,prefix,year) do update set next_number=public.financial_document_counters.next_number+1 returning next_number into n;
  new.code:=code_prefix||'-'||y::text||'-'||lpad(n::text,6,'0');
 end if;
 return new;
end$$;
create function public.am_finance_audit_row() returns trigger language plpgsql security definer set search_path='' as $$
declare previous jsonb:=case when tg_op='INSERT' then null else public.am_money_json(to_jsonb(old)) end; following jsonb:=case when tg_op='DELETE' then null else public.am_money_json(to_jsonb(new)) end; row_data jsonb:=coalesce(following,previous); action text;
begin
 if previous=following then return coalesce(new,old); end if;
 action:=case when tg_table_name='payments' then case when tg_op='INSERT' then 'Payment recorded' when following->>'status'='Reversed' then 'Payment reversed' else 'Payment edited' end else replace(tg_table_name,'_',' ')||' '||lower(tg_op) end;
 if tg_table_name<>'payments' and tg_op='UPDATE' and old.status is distinct from new.status then action:=replace(tg_table_name,'_',' ')||' '||lower(new.status); end if;
 insert into public.financial_audit(tenant_id,actor_id,action,entity_type,entity_id,customer_id,project_id,work_order_id,before_data,after_data,reason)
 values((row_data->>'tenant_id')::uuid,auth.uid(),action,tg_table_name,(row_data->>'id')::uuid,(row_data->>'customer_id')::uuid,(row_data->>'project_id')::uuid,(row_data->>'work_order_id')::uuid,previous,following,coalesce(row_data->>'reversal_reason',row_data->>'cancellation_reason',row_data->>'extra_charge_reason'));
 return coalesce(new,old);
end$$;

-- Parent roll-ups are calculated in PostgreSQL and never accepted from a browser.
create function public.am_refresh_quotation(target uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.quotations where id=target for update;
 update public.quotations q set subtotal=t.subtotal,discount_amount=t.discount_amount,taxable_amount=t.taxable_amount,tax_amount=t.tax_amount,grand_total=t.total
 from(select coalesce(sum(line_subtotal),0) subtotal,coalesce(sum(discount_amount),0) discount_amount,coalesce(sum(taxable_amount),0) taxable_amount,coalesce(sum(tax_amount),0) tax_amount,coalesce(sum(line_total),0) total from public.quotation_items where quotation_id=target) t where q.id=target;
end$$;
create function public.am_quote_totals_trigger() returns trigger language plpgsql security definer set search_path='' as $$begin perform public.am_refresh_quotation(coalesce(new.quotation_id,old.quotation_id)); if tg_op='UPDATE' and old.quotation_id<>new.quotation_id then perform public.am_refresh_quotation(old.quotation_id); end if; return coalesce(new,old); end$$;
create trigger quote_money_rollup after insert or update or delete on public.quotation_items for each row execute function public.am_quote_totals_trigger();
create function public.am_guard_quote_money() returns trigger language plpgsql set search_path='' as $$
declare q public.quotations;
begin
 if tg_table_name='quotations' then
  if tg_op='INSERT' and current_user='authenticated' and (new.subtotal<>0 or new.discount_amount<>0 or new.taxable_amount<>0 or new.tax_amount<>0 or new.grand_total<>0) then raise exception 'Quotation totals are calculated by the server.'; end if;
  if tg_op='UPDATE' and current_user='authenticated' and (new.subtotal,new.discount_amount,new.taxable_amount,new.tax_amount,new.grand_total) is distinct from (old.subtotal,old.discount_amount,old.taxable_amount,old.tax_amount,old.grand_total) then raise exception 'Quotation totals are calculated by the server.'; end if;
 else
  select * into q from public.quotations where id=coalesce(new.quotation_id,old.quotation_id) for update;
  if auth.role()<>'service_role' and q.status='Approved' then raise exception 'Approved quotation pricing is locked. Create a revision.'; end if;
  if auth.role()<>'service_role' and tg_op<>'DELETE' and new.discount>0 and (tg_op='INSERT' or new.discount<>old.discount) and not public.am_can_approve('discount_approval',(public.am_money_line(new.quantity,new.unit_price,new.discount,new.tax))[5]) then raise exception 'Discount approval permission required.'; end if;
 end if;
 return coalesce(new,old);
end$$;
create trigger guard_quote_totals before insert or update on public.quotations for each row execute function public.am_guard_quote_money();
create trigger guard_quote_pricing before insert or update or delete on public.quotation_items for each row execute function public.am_guard_quote_money();
create trigger quote_financial_audit after insert or update on public.quotations for each row execute function public.am_finance_audit_row();
create trigger quote_item_financial_audit after insert or update or delete on public.quotation_items for each row execute function public.am_finance_audit_row();
select public.am_refresh_quotation(id) from public.quotations;

create function public.am_invoice_state(state text,total numeric,paid numeric,due date) returns text language sql stable set search_path='' as $$select case when state in ('Draft','Cancelled') then state when total=paid then 'Paid' when due<public.am_today() then 'Overdue' when paid>0 then 'Partially Paid' else 'Issued' end$$;
create function public.am_refresh_invoice(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.invoices; totals record; paid numeric;
begin
 select * into i from public.invoices where id=target for update;
 if not found then return; end if;
 select coalesce(sum(line_subtotal),0) subtotal,coalesce(sum(discount_amount),0) discount_amount,coalesce(sum(taxable_amount),0) taxable_amount,coalesce(sum(tax_amount),0) tax_amount,coalesce(sum(line_total),0) total into totals from public.invoice_items where invoice_id=target;
 select coalesce(sum(amount),0) into paid from public.payments where invoice_id=target and status='Recorded';
 if paid>totals.total then raise exception 'Invoice changes cannot reduce its total below recorded payments.'; end if;
 update public.invoices set subtotal=totals.subtotal,discount_amount=totals.discount_amount,taxable_amount=totals.taxable_amount,tax_amount=totals.tax_amount,total=totals.total,paid_amount=paid,status=public.am_invoice_state(i.status,totals.total,paid,i.due_date) where id=target;
end$$;
create function public.am_invoice_rollup() returns trigger language plpgsql security definer set search_path='' as $$begin perform public.am_refresh_invoice(coalesce(new.invoice_id,old.invoice_id)); return coalesce(new,old); end$$;
create trigger invoice_item_rollup after insert or update or delete on public.invoice_items for each row execute function public.am_invoice_rollup();
create trigger payment_invoice_rollup after insert or update on public.payments for each row execute function public.am_invoice_rollup();
create function public.am_guard_invoice_item() returns trigger language plpgsql security definer set search_path='' as $$
declare i public.invoices;
begin
 select * into i from public.invoices where id=coalesce(new.invoice_id,old.invoice_id) for update;
 if i.status<>'Draft' then raise exception 'Issued and cancelled invoice items are immutable.'; end if;
 if tg_op<>'DELETE' and new.tenant_id<>i.tenant_id then raise exception 'Invoice item tenant mismatch.'; end if;
 return coalesce(new,old);
end$$;
create trigger protect_invoice_items before insert or update or delete on public.invoice_items for each row execute function public.am_guard_invoice_item();
create function public.am_guard_payment() returns trigger language plpgsql security definer set search_path='' as $$
declare i public.invoices; other_paid numeric;
begin
 select * into i from public.invoices where id=new.invoice_id for update;
 if not found or i.tenant_id<>new.tenant_id or i.customer_id<>new.customer_id then raise exception 'Payment invoice/customer mismatch.'; end if;
 if i.status in ('Draft','Cancelled') then raise exception 'Only issued invoices can receive payments.'; end if;
 if new.payment_date>public.am_today() then raise exception 'Payment date cannot be in the future.'; end if;
 if tg_op='UPDATE' and (new.invoice_id,new.customer_id,new.tenant_id,new.request_id,new.recorded_by) is distinct from (old.invoice_id,old.customer_id,old.tenant_id,old.request_id,old.recorded_by) then raise exception 'Payment identity and original recorder cannot be changed.'; end if;
 select coalesce(sum(amount),0) into other_paid from public.payments where invoice_id=i.id and status='Recorded' and id<>new.id;
 if new.status='Recorded' and new.amount+other_paid>i.total then raise exception 'Payment exceeds the outstanding invoice balance.'; end if;
 return new;
end$$;
create trigger validate_payment before insert or update on public.payments for each row execute function public.am_guard_payment();

-- Scope project managers to their projects. Financial access additionally needs a grant.
create function public.am_managed_project(project uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.projects where id=project and tenant_id=public.am_tenant() and manager_id=auth.uid())$$;
create function public.am_project_operational_scope(entity text,target uuid,customer uuid,work_order uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare project uuid; related_customer uuid; related_site uuid; row_data jsonb;
begin
 if entity='projects' then return public.am_managed_project(target); end if;
 if entity=any(array['customers','contacts']) then return exists(select 1 from public.projects where tenant_id=public.am_tenant() and manager_id=auth.uid() and customer_id=case when entity='customers' then target else customer end); end if;
 if entity='sites' then return exists(select 1 from public.projects where tenant_id=public.am_tenant() and manager_id=auth.uid() and site_id=target); end if;
 if entity=any(array['project_engineers','equipment','work_orders','documents']) then
  execute format('select to_jsonb(t) from public.%I t where id=$1 and tenant_id=$2',entity) into row_data using target,public.am_tenant();
  project:=(row_data->>'project_id')::uuid;
  if project is not null and public.am_managed_project(project) then return true; end if;
 end if;
 if work_order is not null then select project_id into project from public.work_orders where id=work_order and tenant_id=public.am_tenant(); return public.am_managed_project(project); end if;
 return false;
end$$;
create or replace function public.am_scope(entity text,row_id uuid,customer uuid default null,work_order uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select case when public.am_role()='project_manager' then public.am_project_operational_scope(entity,row_id,customer,work_order)
 when public.am_role()<>'engineer' then true else case
 when entity=any(array['customers','sites','equipment','complaints','work_orders']) then public.am_engineer_scope(entity,row_id)
 when entity='contacts' then public.am_engineer_scope('customers',customer)
 when entity=any(array['work_order_readings','work_order_parts','work_order_activities','service_reports','documents','activity_log']) then work_order is not null and public.am_engineer_scope('work_orders',work_order) else false end end
$$;
create function public.am_finance_scope(entity text,target uuid,project uuid default null,work_order uuid default null,invoice uuid default null) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if not public.am_finance_allowed(entity) then return false; end if;
 if public.am_role()='service_manager' then return work_order is not null and entity=any(array['service_charges','work_order_part_financials','cost_records']); end if;
 if public.am_role()='project_manager' then
  if project is null and invoice is not null then select project_id into project from public.invoices where id=invoice and tenant_id=public.am_tenant(); end if;
  return project is not null and public.am_project_finance_scope(project);
 end if;
 return true;
end$$;

create function public.am_financial_parent() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.projects; a public.amc_contracts; w public.work_orders; part public.work_order_parts;
begin
 if tg_table_name='work_order_part_financials' then
  select * into part from public.work_order_parts where id=new.part_id and tenant_id=new.tenant_id;
  if not found then raise exception 'Part record unavailable.'; end if; new.work_order_id:=part.work_order_id;
 end if;
 if (to_jsonb(new)->>'work_order_id') is not null then
  select * into w from public.work_orders where id=new.work_order_id and tenant_id=new.tenant_id;
  if not found then raise exception 'Work order unavailable.'; end if;
  if new.project_id is not null and new.project_id is distinct from w.project_id then raise exception 'Work order/project mismatch.'; end if;
  new.project_id:=w.project_id;
  if new.customer_id is not null and new.customer_id<>w.customer_id then raise exception 'Work order/customer mismatch.'; end if; new.customer_id:=w.customer_id;
 end if;
 if new.project_id is not null then
  select * into p from public.projects where id=new.project_id and tenant_id=new.tenant_id;
  if not found then raise exception 'Project unavailable.'; end if;
  if new.customer_id is not null and new.customer_id<>p.customer_id then raise exception 'Project/customer mismatch.'; end if; new.customer_id:=p.customer_id;
 end if;
 if tg_table_name='amc_financials' then
  select * into a from public.amc_contracts where id=new.amc_id and tenant_id=new.tenant_id;
  if not found then raise exception 'AMC unavailable.'; end if;
  if new.customer_id is not null and new.customer_id<>a.customer_id then raise exception 'AMC/customer mismatch.'; end if; new.customer_id:=a.customer_id;
 end if;
 return new;
end$$;
-- Separate trigger for AMC rows, which intentionally have no work/project columns.
create function public.am_amc_finance_parent() returns trigger language plpgsql security definer set search_path='' as $$
declare customer uuid;
begin select customer_id into customer from public.amc_contracts where id=new.amc_id and tenant_id=new.tenant_id; if customer is null then raise exception 'AMC unavailable.'; end if; if new.customer_id is not null and new.customer_id<>customer then raise exception 'AMC/customer mismatch.'; end if; new.customer_id:=customer; return new; end$$;
create trigger amc_finance_links before insert or update on public.amc_financials for each row execute function public.am_amc_finance_parent();
create trigger project_money_links before insert or update on public.project_financials for each row execute function public.am_financial_parent();
create trigger variation_money_links before insert or update on public.project_variations for each row execute function public.am_financial_parent();
create trigger service_money_links before insert or update on public.service_charges for each row execute function public.am_financial_parent();
create trigger part_money_links before insert or update on public.work_order_part_financials for each row execute function public.am_financial_parent();
create trigger cost_money_links before insert or update on public.cost_records for each row execute function public.am_financial_parent();

create function public.am_invoice_links() returns trigger language plpgsql security definer set search_path='' as $$
declare customer uuid; project uuid;
begin
 if new.source_type='Project' then
  if new.project_id is null or new.amc_id is not null or new.work_order_id is not null then raise exception 'Select one project invoice source.'; end if;
  select customer_id into customer from public.projects where id=new.project_id and tenant_id=new.tenant_id;
 elsif new.source_type='AMC' then
  if new.amc_id is null or new.project_id is not null or new.work_order_id is not null then raise exception 'Select one AMC invoice source.'; end if;
  select customer_id into customer from public.amc_contracts where id=new.amc_id and tenant_id=new.tenant_id;
 elsif new.source_type='Service' then
  if new.work_order_id is null or new.amc_id is not null then raise exception 'Select one service job invoice source.'; end if;
  select customer_id,project_id into customer,project from public.work_orders where id=new.work_order_id and tenant_id=new.tenant_id;
  if new.project_id is not null and new.project_id is distinct from project then raise exception 'Service project mismatch.'; end if; new.project_id:=project;
 else
  if new.project_id is not null or new.amc_id is not null or new.work_order_id is not null then raise exception 'Select the invoice source type.'; end if;
  customer:=new.customer_id;
 end if;
 if customer is null or new.customer_id<>customer then raise exception 'Invoice source/customer mismatch.'; end if;
 if tg_op='UPDATE' and old.status<>'Draft' and (new.customer_id,new.project_id,new.amc_id,new.work_order_id,new.invoice_date,new.due_date,new.currency,new.name) is distinct from (old.customer_id,old.project_id,old.amc_id,old.work_order_id,old.invoice_date,old.due_date,old.currency,old.name) then raise exception 'Issued invoice identity and dates are locked.'; end if;
 return new;
end$$;
create trigger invoice_source_links before insert or update on public.invoices for each row execute function public.am_invoice_links();

create function public.am_initialize_project_financials() returns trigger language plpgsql security definer set search_path='' as $$
declare amount numeric;
begin
 select grand_total into amount from public.quotations where id=new.quotation_id and tenant_id=new.tenant_id and status='Approved';
 insert into public.project_financials(tenant_id,name,project_id,customer_id,base_value) values(new.tenant_id,new.name,new.id,new.customer_id,amount) on conflict(project_id) do nothing; return new;
end$$;
create trigger project_commercial_value after insert on public.projects for each row execute function public.am_initialize_project_financials();
insert into public.project_financials(tenant_id,code,name,project_id,customer_id,base_value) select p.tenant_id,'PF-'||p.code,p.name,p.id,p.customer_id,q.grand_total from public.projects p left join public.quotations q on q.id=p.quotation_id and q.status='Approved';
insert into public.amc_financials(tenant_id,code,name,amc_id,customer_id) select tenant_id,'AF-'||code,name,id,customer_id from public.amc_contracts;
create function public.am_initialize_amc_financials() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.amc_financials(tenant_id,name,amc_id,customer_id) values(new.tenant_id,new.name,new.id,new.customer_id) on conflict(amc_id) do nothing; return new; end$$;
create trigger amc_commercial_value after insert on public.amc_contracts for each row execute function public.am_initialize_amc_financials();

create function public.am_service_classification(work uuid) returns text language sql stable security definer set search_path='' as $$
 select coalesce(c.classification,case when exists(select 1 from public.pm_schedules p where p.work_order_id=w.id and p.amc_id is not null) then 'AMC Service' else 'Paid Service' end) from public.work_orders w left join public.complaints c on c.id=w.complaint_id where w.id=work
$$;
create function public.am_guard_service_charge() returns trigger language plpgsql security definer set search_path='' as $$
declare amount numeric; mode text;
begin
 amount:=(public.am_money_line(1,new.inspection_fee+new.labour_charge+new.parts_charge+new.recorded_parts_charge+new.other_charges,new.discount,new.tax))[5];
 mode:=public.am_service_classification(new.work_order_id);
 if auth.role()<>'service_role' and mode<>'Paid Service' and amount>0 then
  if nullif(trim(new.extra_charge_reason),'') is null then raise exception 'Warranty/AMC extra charges require an explicit reason.'; end if;
  if not public.am_can_approve('service_extra_charge',amount,new.project_id) and new.approved_by is null then raise exception 'An authorized extra-charge approval is required.'; end if;
 end if;
 return new;
end$$;
create trigger covered_service_charge_guard before insert or update on public.service_charges for each row execute function public.am_guard_service_charge();

-- Part costs generate exactly one traceable operational cost row. Engineers cannot see prices.
create function public.am_refresh_parts_money(work uuid) returns void language plpgsql security definer set search_path='' as $$
declare value numeric;
begin
 select coalesce(sum(round(p.quantity*f.unit_sell_price,3)) filter(where f.chargeable),0) into value from public.work_order_parts p join public.work_order_part_financials f on f.part_id=p.id where p.work_order_id=work;
 update public.service_charges set recorded_parts_charge=value,status=case when status='Approved' and recorded_parts_charge<>value then 'Draft' else status end where work_order_id=work and recorded_parts_charge<>value;
end$$;
create function public.am_part_cost_trigger() returns trigger language plpgsql security definer set search_path='' as $$
declare part public.work_order_parts; f public.work_order_part_financials; w public.work_orders;
begin
 if tg_table_name='work_order_parts' then part:=new; select * into f from public.work_order_part_financials where part_id=part.id; if not found then return new; end if;
 else f:=new; select * into part from public.work_order_parts where id=f.part_id; end if;
 select * into w from public.work_orders where id=part.work_order_id;
 if auth.role()<>'service_role' and exists(select 1 from public.service_charges where work_order_id=w.id and status='Invoiced') then raise exception 'Billed service parts are locked.'; end if;
 insert into public.cost_records(tenant_id,name,customer_id,project_id,work_order_id,source_part_id,cost_type,quantity,unit_cost,recorded_by,notes)
 values(w.tenant_id,part.name,w.customer_id,w.project_id,w.id,part.id,'Materials',part.quantity,f.unit_cost,auth.uid(),'Generated from recorded part costs')
 on conflict(source_part_id) do update set quantity=excluded.quantity,unit_cost=excluded.unit_cost,project_id=excluded.project_id;
 perform public.am_refresh_parts_money(w.id); return new;
end$$;
create trigger part_financial_cost after insert or update on public.work_order_part_financials for each row execute function public.am_part_cost_trigger();
create trigger part_usage_cost after update of quantity on public.work_order_parts for each row execute function public.am_part_cost_trigger();
create function public.am_service_parts_initial() returns trigger language plpgsql security definer set search_path='' as $$begin perform public.am_refresh_parts_money(new.work_order_id); return new; end$$;
create trigger service_parts_initial after insert on public.service_charges for each row execute function public.am_service_parts_initial();

-- New financial tables have SELECT-only RLS for authenticated users. Writes use checked RPCs.
do $$declare t text; project_expr text; work_expr text; invoice_expr text; begin
 foreach t in array array['project_financials','project_variations','amc_financials','invoices','invoice_items','payments','service_charges','work_order_part_financials','cost_records'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create trigger financial_reference before insert on public.%I for each row execute function public.am_finance_code()',t);
  execute format('create trigger financial_audit after insert or update or delete on public.%I for each row execute function public.am_finance_audit_row()',t);
  execute format('create index on public.%I(tenant_id,status,created_at desc)',t);
  project_expr:=case when t=any(array['project_financials','project_variations','invoices','service_charges','work_order_part_financials','cost_records']) then 'project_id' else 'null::uuid' end;
  work_expr:=case when t=any(array['invoices','service_charges','work_order_part_financials','cost_records']) then 'work_order_id' else 'null::uuid' end;
  invoice_expr:=case when t=any(array['invoice_items','payments']) then 'invoice_id' else 'null::uuid' end;
  execute format('create policy finance_read on public.%I for select to authenticated using(tenant_id=public.am_tenant() and public.am_finance_scope(%L,id,%s,%s,%s))',t,t,project_expr,work_expr,invoice_expr);
  execute format('grant select on public.%I to authenticated; grant select,insert,update,delete on public.%I to service_role',t,t);
 end loop;
end$$;
alter table public.financial_audit enable row level security;
create policy audit_finance_read on public.financial_audit for select to authenticated using(tenant_id=public.am_tenant() and public.am_role() in ('owner_director','super_admin','management','accounts_finance'));
grant select on public.financial_audit to authenticated; grant all on public.financial_audit to service_role;
alter table public.approval_rules enable row level security; alter table public.project_finance_access enable row level security; alter table public.financial_document_counters enable row level security;
create policy admin_approval_rules on public.approval_rules for select to authenticated using(tenant_id=public.am_tenant() and public.am_role()='super_admin');
create policy admin_project_grants on public.project_finance_access for select to authenticated using(tenant_id=public.am_tenant() and public.am_role()='super_admin');
grant select on public.approval_rules,public.project_finance_access to authenticated;
grant all on public.approval_rules,public.project_finance_access,public.financial_document_counters to service_role;

create view public.receivables with(security_invoker=true) as
 select i.*,public.am_invoice_state(i.status,i.total,i.paid_amount,i.due_date) effective_status,
 greatest(public.am_today()-i.invoice_date,0) days_outstanding,greatest(public.am_today()-i.due_date,0) days_overdue,
 case when i.due_date>=public.am_today() then 'Current' when public.am_today()-i.due_date<=30 then '1–30 Days' when public.am_today()-i.due_date<=60 then '31–60 Days' when public.am_today()-i.due_date<=90 then '61–90 Days' else '90+ Days' end aging_bucket
 from public.invoices i where i.status not in ('Draft','Cancelled') and i.balance>0;
grant select on public.receivables to authenticated,service_role;
create view public.project_financial_summary with(security_invoker=true) as
 with financial_values as(select f.*,p.status project_status,p.target_date,p.quotation_id,q.grand_total quoted_value,
 coalesce((select sum(amount) from public.project_variations where project_id=f.project_id),0) variation_value,
 coalesce((select sum(amount) from public.project_variations where project_id=f.project_id and status='Approved'),0) approved_variation_value,
 coalesce((select sum(total) from public.invoices where project_id=f.project_id and status not in ('Draft','Cancelled')),0) invoiced_amount,
 coalesce((select sum(paid_amount) from public.invoices where project_id=f.project_id and status not in ('Draft','Cancelled')),0) paid_amount,
 coalesce((select sum(balance) from public.invoices where project_id=f.project_id and status not in ('Draft','Cancelled')),0) outstanding_amount,
 coalesce(f.actual_cost_override,(select sum(total_cost) from public.cost_records where project_id=f.project_id)) actual_cost
 from public.project_financials f join public.projects p on p.id=f.project_id left join public.quotations q on q.id=p.quotation_id), totals as(select *,base_value+approved_variation_value project_revenue from financial_values)
 select *,case when recognized_revenue is not null and actual_cost is not null then recognized_revenue-actual_cost end gross_profit,
 case when recognized_revenue>0 and actual_cost is not null then round((recognized_revenue-actual_cost)/recognized_revenue*100,3) end gross_margin_percent from totals;
grant select on public.project_financial_summary to authenticated,service_role;
create view public.amc_financial_summary with(security_invoker=true) as
 select f.*,a.start_date,a.end_date,a.status contract_status,
 coalesce((select sum(total) from public.invoices where amc_id=f.amc_id and status not in ('Draft','Cancelled')),0) amount_billed,
 coalesce((select sum(paid_amount) from public.invoices where amc_id=f.amc_id and status not in ('Draft','Cancelled')),0) amount_paid,
 coalesce((select sum(balance) from public.invoices where amc_id=f.amc_id and status not in ('Draft','Cancelled')),0) outstanding
 from public.amc_financials f join public.amc_contracts a on a.id=f.amc_id;
grant select on public.amc_financial_summary to authenticated,service_role;

-- Mutations and public RPC grants follow in the next migration.
commit;
