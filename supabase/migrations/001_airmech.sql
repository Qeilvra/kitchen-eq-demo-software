-- AIRMECH ONE: isolated demo tenant, relational data and server-enforced permissions.
begin;
create extension if not exists pgcrypto;
create table public.tenants (id uuid primary key, name text not null, is_demo boolean not null default false);
create table public.roles (name text primary key check (name in ('super_admin','management','sales_admin','service_manager','engineer')));
insert into public.roles values ('super_admin'),('management'),('sales_admin'),('service_manager'),('engineer');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  full_name text not null,
  role text not null references public.roles(name),
  unique(id,tenant_id)
);
create function public.am_today() returns date language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Muscat')::date $$;
create function public.am_tenant() returns uuid language sql stable security definer set search_path = '' as $$ select tenant_id from public.profiles where id = auth.uid() $$;
create function public.am_role() returns text language sql stable security definer set search_path = '' as $$ select role from public.profiles where id = auth.uid() $$;
create function public.am_allowed(entity text, writing boolean default false) returns boolean language sql stable security definer set search_path = '' as $$
 select case public.am_role()
 when 'super_admin' then true
 when 'management' then not writing or entity <> 'engineers'
 when 'sales_admin' then entity = any(array['customers','contacts','sites','enquiries','enquiry_activities','quotations','quotation_items','quotation_followups','projects','project_engineers','documents','notifications','activity_log'])
 when 'service_manager' then entity = any(array['customers','contacts','sites','equipment','complaints','engineers','work_orders','work_order_readings','work_order_parts','work_order_activities','amc_contracts','amc_equipment','pm_schedules','pm_visits','service_reports','documents','notifications','activity_log'])
 when 'engineer' then case when writing then entity = any(array['work_order_readings','work_order_parts','documents']) else entity = any(array['customers','contacts','sites','equipment','complaints','work_orders','work_order_readings','work_order_parts','work_order_activities','service_reports','documents','notifications','activity_log']) end
 else false end
$$;

create table public.customers (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Active', created_at timestamptz not null default now(),
 type text not null default 'Commercial', phone text, email text, address text, notes text, unique(id,tenant_id), unique(tenant_id,code)
);
create table public.contacts (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Active', created_at timestamptz not null default now(),
 customer_id uuid not null, role text, phone text, email text, preferred_method text default 'Phone', notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete cascade
);
create table public.sites (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Active', created_at timestamptz not null default now(),
 customer_id uuid not null, contact_id uuid, address text, location text, access_instructions text, notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete cascade, foreign key(contact_id,tenant_id) references public.contacts(id,tenant_id)
);
create table public.engineers (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Available', created_at timestamptz not null default now(),
 profile_id uuid, specialization text, phone text, skills text, notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(profile_id,tenant_id) references public.profiles(id,tenant_id)
);
create table public.enquiries (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'New', created_at timestamptz not null default now(),
 customer_id uuid not null, site_id uuid not null, contact_id uuid, received_date date default public.am_today(), source text default 'Phone', category text default 'Service', description text, priority text default 'Normal', assigned_to uuid, followup_date date, notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete cascade, foreign key(site_id,tenant_id) references public.sites(id,tenant_id), foreign key(contact_id,tenant_id) references public.contacts(id,tenant_id), foreign key(assigned_to,tenant_id) references public.profiles(id,tenant_id)
);
create table public.enquiry_activities (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Recorded', created_at timestamptz not null default now(), enquiry_id uuid not null, notes text, followup_date date,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(enquiry_id,tenant_id) references public.enquiries(id,tenant_id) on delete cascade
);
create table public.quotations (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Draft', created_at timestamptz not null default now(),
 customer_id uuid not null, site_id uuid not null, enquiry_id uuid, quotation_date date default public.am_today(), valid_until date, followup_date date, salesperson_id uuid, revision integer not null default 1 check(revision>0), sent_at timestamptz, notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete cascade, foreign key(site_id,tenant_id) references public.sites(id,tenant_id), foreign key(enquiry_id,tenant_id) references public.enquiries(id,tenant_id), foreign key(salesperson_id,tenant_id) references public.profiles(id,tenant_id)
);
create table public.quotation_items (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Active', created_at timestamptz not null default now(), quotation_id uuid not null,
 quantity numeric(12,3) not null default 1 check(quantity>0), unit text default 'Each', unit_price numeric(12,3) not null default 0 check(unit_price>=0), discount numeric(5,2) not null default 0 check(discount between 0 and 100), tax numeric(5,2) not null default 5 check(tax between 0 and 100),
 unique(id,tenant_id), unique(tenant_id,code), foreign key(quotation_id,tenant_id) references public.quotations(id,tenant_id) on delete cascade
);
create table public.quotation_followups (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Due', created_at timestamptz not null default now(), quotation_id uuid not null, followup_date date not null, notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(quotation_id,tenant_id) references public.quotations(id,tenant_id) on delete cascade
);
create table public.projects (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Planning', created_at timestamptz not null default now(),
 customer_id uuid not null, site_id uuid not null, quotation_id uuid, type text default 'Installation', description text, start_date date, target_date date, manager_id uuid, progress integer not null default 0 check(progress between 0 and 100), notes text,
 unique(id,tenant_id), unique(tenant_id,code), unique(quotation_id), foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete cascade, foreign key(site_id,tenant_id) references public.sites(id,tenant_id), foreign key(quotation_id,tenant_id) references public.quotations(id,tenant_id), foreign key(manager_id,tenant_id) references public.profiles(id,tenant_id)
);
create table public.project_engineers (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Assigned', created_at timestamptz not null default now(), project_id uuid not null, engineer_id uuid not null,
 unique(id,tenant_id), unique(tenant_id,code), unique(project_id,engineer_id), foreign key(project_id,tenant_id) references public.projects(id,tenant_id) on delete cascade, foreign key(engineer_id,tenant_id) references public.engineers(id,tenant_id)
);
create table public.amc_contracts (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Active', created_at timestamptz not null default now(),
 customer_id uuid not null, site_id uuid not null, start_date date not null, end_date date not null, frequency text default 'Quarterly', planned_visits integer not null default 4 check(planned_visits>0), next_visit date, renewal_date date, notes text, check(end_date>=start_date),
 unique(id,tenant_id), unique(tenant_id,code), foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete cascade, foreign key(site_id,tenant_id) references public.sites(id,tenant_id)
);
create table public.equipment (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Active', created_at timestamptz not null default now(),
 customer_id uuid not null, site_id uuid not null, project_id uuid, amc_id uuid, type text not null default 'AHU', brand text, model text, serial_number text, capacity text, installation_date date, commissioning_date date, warranty_start date, warranty_end date, service_frequency text default 'Quarterly', last_service date, next_service date, notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete cascade, foreign key(site_id,tenant_id) references public.sites(id,tenant_id), foreign key(project_id,tenant_id) references public.projects(id,tenant_id), foreign key(amc_id,tenant_id) references public.amc_contracts(id,tenant_id), check(warranty_end is null or warranty_start is null or warranty_end>=warranty_start)
);
create table public.amc_equipment (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Covered', created_at timestamptz not null default now(), amc_id uuid not null, equipment_id uuid not null,
 unique(id,tenant_id), unique(tenant_id,code), unique(amc_id,equipment_id), foreign key(amc_id,tenant_id) references public.amc_contracts(id,tenant_id) on delete cascade, foreign key(equipment_id,tenant_id) references public.equipment(id,tenant_id) on delete cascade
);
create table public.complaints (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'New', created_at timestamptz not null default now(),
 customer_id uuid not null, site_id uuid not null, equipment_id uuid not null, reported_by text, reported_at timestamptz not null default now(), problem text not null, priority text not null default 'Normal' check(priority in ('Low','Normal','High','Emergency')), classification text not null default 'Paid Service', engineer_id uuid, override_reason text, override_by uuid references public.profiles(id), override_at timestamptz, notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete cascade, foreign key(site_id,tenant_id) references public.sites(id,tenant_id), foreign key(equipment_id,tenant_id) references public.equipment(id,tenant_id), foreign key(engineer_id,tenant_id) references public.engineers(id,tenant_id)
);
create table public.work_orders (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Scheduled', created_at timestamptz not null default now(),
 customer_id uuid not null, site_id uuid not null, equipment_id uuid not null, complaint_id uuid unique, engineer_id uuid, scheduled_at timestamptz not null default now(), priority text default 'Normal', problem text, diagnosis text, work_performed text, recommendations text, customer_confirmation text, completed_at timestamptz,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete cascade, foreign key(site_id,tenant_id) references public.sites(id,tenant_id), foreign key(equipment_id,tenant_id) references public.equipment(id,tenant_id), foreign key(complaint_id,tenant_id) references public.complaints(id,tenant_id), foreign key(engineer_id,tenant_id) references public.engineers(id,tenant_id)
);
create table public.work_order_readings (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Recorded', created_at timestamptz not null default now(), work_order_id uuid not null, value numeric(12,3) not null, unit text not null, notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(work_order_id,tenant_id) references public.work_orders(id,tenant_id) on delete cascade
);
create table public.work_order_parts (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Used', created_at timestamptz not null default now(), work_order_id uuid not null, quantity numeric(12,3) not null default 1 check(quantity>0), unit text default 'Each', notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(work_order_id,tenant_id) references public.work_orders(id,tenant_id) on delete cascade
);
create table public.work_order_activities (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Recorded', created_at timestamptz not null default now(), work_order_id uuid not null, notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(work_order_id,tenant_id) references public.work_orders(id,tenant_id) on delete cascade
);
create table public.pm_schedules (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Upcoming', created_at timestamptz not null default now(),
 customer_id uuid not null, site_id uuid not null, equipment_id uuid not null, amc_id uuid, engineer_id uuid, planned_date date not null, frequency text default 'Quarterly', work_order_id uuid unique, notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete cascade, foreign key(site_id,tenant_id) references public.sites(id,tenant_id), foreign key(equipment_id,tenant_id) references public.equipment(id,tenant_id), foreign key(amc_id,tenant_id) references public.amc_contracts(id,tenant_id), foreign key(engineer_id,tenant_id) references public.engineers(id,tenant_id), foreign key(work_order_id,tenant_id) references public.work_orders(id,tenant_id)
);
create table public.pm_visits (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Completed', created_at timestamptz not null default now(), schedule_id uuid not null unique, work_order_id uuid not null, visit_date date not null default public.am_today(), notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(schedule_id,tenant_id) references public.pm_schedules(id,tenant_id) on delete cascade, foreign key(work_order_id,tenant_id) references public.work_orders(id,tenant_id)
);
create table public.service_reports (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Completed', created_at timestamptz not null default now(),
 work_order_id uuid not null unique, customer_id uuid not null, site_id uuid not null, equipment_id uuid not null, engineer_id uuid, visit_date date not null default public.am_today(), reported_issue text, diagnosis text, work_completed text, recommendations text, customer_confirmation text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(work_order_id,tenant_id) references public.work_orders(id,tenant_id) on delete cascade, foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete cascade, foreign key(site_id,tenant_id) references public.sites(id,tenant_id), foreign key(equipment_id,tenant_id) references public.equipment(id,tenant_id), foreign key(engineer_id,tenant_id) references public.engineers(id,tenant_id)
);
create table public.documents (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Available', created_at timestamptz not null default now(),
 customer_id uuid not null, site_id uuid, quotation_id uuid, project_id uuid, equipment_id uuid, complaint_id uuid, work_order_id uuid, amc_id uuid, service_report_id uuid, storage_path text not null, mime_type text, size_bytes bigint,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete cascade, foreign key(site_id,tenant_id) references public.sites(id,tenant_id), foreign key(quotation_id,tenant_id) references public.quotations(id,tenant_id), foreign key(project_id,tenant_id) references public.projects(id,tenant_id), foreign key(equipment_id,tenant_id) references public.equipment(id,tenant_id), foreign key(complaint_id,tenant_id) references public.complaints(id,tenant_id), foreign key(work_order_id,tenant_id) references public.work_orders(id,tenant_id), foreign key(amc_id,tenant_id) references public.amc_contracts(id,tenant_id), foreign key(service_report_id,tenant_id) references public.service_reports(id,tenant_id)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Unread', created_at timestamptz not null default now(),
 recipient_id uuid, entity_type text not null, entity_id uuid not null, notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(recipient_id,tenant_id) references public.profiles(id,tenant_id)
);
create unique index notification_dedup on public.notifications(tenant_id,entity_type,entity_id,name);
create table public.activity_log (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null default '', name text not null, status text not null default 'Recorded', created_at timestamptz not null default now(),
 actor_id uuid references public.profiles(id), customer_id uuid, equipment_id uuid, work_order_id uuid, entity_type text not null, entity_id uuid not null, notes text,
 unique(id,tenant_id), unique(tenant_id,code), foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete cascade, foreign key(equipment_id,tenant_id) references public.equipment(id,tenant_id), foreign key(work_order_id,tenant_id) references public.work_orders(id,tenant_id)
);

-- Security-definer helpers read only assignment links, avoiding recursive RLS.
create function public.am_engineer_scope(entity text, target uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.work_orders w join public.engineers e on e.id=w.engineer_id
 where e.profile_id=auth.uid() and w.tenant_id=public.am_tenant() and
 case entity when 'work_orders' then w.id=target when 'customers' then w.customer_id=target when 'contacts' then w.customer_id=target when 'sites' then w.site_id=target when 'equipment' then w.equipment_id=target when 'complaints' then w.complaint_id=target else false end)
$$;
create function public.am_scope(entity text, row_id uuid, customer uuid default null, work_order uuid default null) returns boolean language sql stable security definer set search_path = '' as $$
 select public.am_role()<>'engineer' or case
 when entity = any(array['customers','sites','equipment','complaints','work_orders']) then public.am_engineer_scope(entity,row_id)
 when entity='contacts' then public.am_engineer_scope('customers',customer)
 when entity=any(array['work_order_readings','work_order_parts','work_order_activities','service_reports','documents','activity_log']) then work_order is not null and public.am_engineer_scope('work_orders',work_order)
 else false end
$$;
create function public.am_ref() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.code='' then new.code:=(case tg_table_name when 'quotations' then 'QTN' when 'equipment' then 'AST' when 'complaints' then 'CMP' when 'work_orders' then 'WO' when 'projects' then 'PRJ' when 'service_reports' then 'SR' when 'amc_contracts' then 'AMC' when 'pm_schedules' then 'PM' else upper(left(tg_table_name,3)) end)||'-'||to_char(now(),'YYMM')||'-'||upper(left(replace(new.id::text,'-',''),8)); end if;
 return new;
end $$;
create function public.am_validate_links() returns trigger language plpgsql security definer set search_path = '' as $$
declare j jsonb:=to_jsonb(new); site_customer uuid; asset public.equipment; linked jsonb; key text; tab text;
begin
 if j->>'customer_id' is not null and j->>'site_id' is not null then
  select customer_id into site_customer from public.sites where id=(j->>'site_id')::uuid;
  if site_customer is distinct from (j->>'customer_id')::uuid then raise exception 'The site does not belong to this customer.'; end if;
 end if;
 if j->>'equipment_id' is not null then
  select * into asset from public.equipment where id=(j->>'equipment_id')::uuid;
  if (j->>'customer_id' is not null and asset.customer_id<>(j->>'customer_id')::uuid) or (j->>'site_id' is not null and asset.site_id<>(j->>'site_id')::uuid) then raise exception 'The equipment does not belong to this customer and site.'; end if;
 end if;
 foreach key in array array['contact_id','enquiry_id','quotation_id','project_id','amc_id','complaint_id','work_order_id','service_report_id'] loop
  tab:=case key when 'contact_id' then 'contacts' when 'enquiry_id' then 'enquiries' when 'quotation_id' then 'quotations' when 'project_id' then 'projects' when 'amc_id' then 'amc_contracts' when 'complaint_id' then 'complaints' when 'work_order_id' then 'work_orders' when 'service_report_id' then 'service_reports' end;
  if j->>key is not null then
   execute format('select to_jsonb(t) from public.%I t where id=$1',tab) into linked using (j->>key)::uuid;
   if (j->>'customer_id' is not null and linked->>'customer_id' is not null and j->>'customer_id'<>linked->>'customer_id') or (j->>'site_id' is not null and linked->>'site_id' is not null and j->>'site_id'<>linked->>'site_id') or (j->>'equipment_id' is not null and linked->>'equipment_id' is not null and j->>'equipment_id'<>linked->>'equipment_id') or (key='amc_id' and j->>'equipment_id' is not null and (asset.customer_id<>(linked->>'customer_id')::uuid or asset.site_id<>(linked->>'site_id')::uuid)) then raise exception 'Linked records must belong to the same customer, site and equipment.'; end if;
  end if;
 end loop;
 if tg_table_name='projects' and j->>'quotation_id' is not null and not exists(select 1 from public.quotations where id=(j->>'quotation_id')::uuid and status='Approved') then raise exception 'Approve the quotation before creating a project.'; end if;
 return new;
end $$;
create function public.am_classify() returns trigger language plpgsql security definer set search_path = '' as $$
declare a public.equipment; contract public.amc_contracts;
begin
 if tg_op='UPDATE' and new.classification<>old.classification then
  if public.am_role() not in ('super_admin','management','service_manager') or nullif(trim(new.override_reason),'') is null then raise exception 'A classification override requires an authorized user and a reason.'; end if;
  new.override_by:=auth.uid(); new.override_at:=now();
 elsif tg_op='INSERT' or new.equipment_id<>old.equipment_id then
  select * into a from public.equipment where id=new.equipment_id;
  select * into contract from public.amc_contracts where id=a.amc_id;
  new.classification:=case when a.warranty_end>=public.am_today() and (a.warranty_start is null or a.warranty_start<=public.am_today()) then 'Warranty Service' when contract.status in ('Active','Expiring') and contract.start_date<=public.am_today() and contract.end_date>=public.am_today() then 'AMC Service' else 'Paid Service' end;
  new.override_reason:=null; new.override_by:=null; new.override_at:=null;
 end if;
 return new;
end $$;
create trigger classify_complaint before insert or update on public.complaints for each row execute function public.am_classify();
create function public.am_guard_records() returns trigger language plpgsql set search_path = '' as $$
begin
 if current_user='authenticated' then
  if tg_table_name='quotations' and tg_op='UPDATE' and new.status<>old.status then raise exception 'Use the quotation workflow to change its stage.'; end if;
  if tg_table_name='complaints' then
   if tg_op='INSERT' and (new.status<>'New' or new.engineer_id is not null) then raise exception 'Dispatch through the complaint workflow.'; end if;
   if tg_op='UPDATE' then
    if new.status<>old.status or new.engineer_id is distinct from old.engineer_id then raise exception 'Use the complaint and dispatch workflow to change its stage or engineer.'; end if;
    if (new.customer_id<>old.customer_id or new.site_id<>old.site_id or new.equipment_id<>old.equipment_id) and exists(select 1 from public.work_orders where complaint_id=old.id) then raise exception 'An assigned complaint cannot be moved to another asset.'; end if;
   end if;
  end if;
  if tg_table_name='equipment' and tg_op='UPDATE' and (new.customer_id<>old.customer_id or new.site_id<>old.site_id) and exists(select 1 from public.complaints where equipment_id=old.id) then raise exception 'An asset with service history cannot be moved to another customer/site.'; end if;
 end if;
 return new;
end $$;
create trigger protect_quote_stage before update on public.quotations for each row execute function public.am_guard_records();
create trigger protect_complaint_stage before insert or update on public.complaints for each row execute function public.am_guard_records();
create trigger protect_asset_links before update on public.equipment for each row execute function public.am_guard_records();
create function public.am_coverage() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if pg_trigger_depth()>1 or auth.role()='service_role' then return new; end if;
 if tg_table_name='equipment' then
  if new.amc_id is not null then insert into public.amc_equipment(tenant_id,name,amc_id,equipment_id) values(new.tenant_id,new.name,new.amc_id,new.id) on conflict(amc_id,equipment_id) do nothing; end if;
 else
  update public.equipment set amc_id=new.amc_id where id=new.equipment_id and tenant_id=new.tenant_id;
 end if;
 return new;
end $$;
create trigger sync_equipment_coverage after insert or update of amc_id on public.equipment for each row execute function public.am_coverage();
create trigger sync_contract_coverage after insert or update on public.amc_equipment for each row execute function public.am_coverage();

do $$ declare t text; c text; customer_expr text; work_expr text; begin
 foreach t in array array['customers','contacts','sites','engineers','enquiries','enquiry_activities','quotations','quotation_items','quotation_followups','projects','project_engineers','amc_contracts','equipment','amc_equipment','complaints','work_orders','work_order_readings','work_order_parts','work_order_activities','pm_schedules','pm_visits','service_reports','documents','notifications','activity_log'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create trigger reference_code before insert on public.%I for each row execute function public.am_ref()',t);
  execute format('create trigger validate_links before insert or update on public.%I for each row execute function public.am_validate_links()',t);
  execute format('create index on public.%I (tenant_id,status,created_at desc)',t);
  for c in select column_name from information_schema.columns where table_schema='public' and table_name=t and column_name like '%\_id' escape '\' and column_name<>'tenant_id' loop
   execute format('create index on public.%I (%I)',t,c);
  end loop;
  customer_expr:=case when exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='customer_id') then 'customer_id' else 'null::uuid' end;
  work_expr:=case when exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='work_order_id') then 'work_order_id' else 'null::uuid' end;
  if t='notifications' then
   execute 'create policy read_notifications on public.notifications for select to authenticated using (tenant_id=public.am_tenant() and (recipient_id=auth.uid() or (recipient_id is null and public.am_role()<>''engineer'')) and public.am_allowed(entity_type))';
  else
   execute format('create policy read_records on public.%I for select to authenticated using (tenant_id=public.am_tenant() and public.am_allowed(%L) and public.am_scope(%L,id,%s,%s))',t,t,t,customer_expr,work_expr);
  end if;
  -- Sensitive state changes use validated workflow functions rather than direct updates.
  if t not in ('work_orders','service_reports','work_order_activities','activity_log','pm_visits') then
   execute format('create policy insert_records on public.%I for insert to authenticated with check (tenant_id=public.am_tenant() and public.am_allowed(%L,true) and public.am_scope(%L,id,%s,%s))',t,t,t,customer_expr,work_expr);
  end if;
  execute format('grant select,insert,update,delete on public.%I to authenticated,service_role',t);
  if t not in ('work_orders','service_reports','work_order_activities','activity_log') then
   execute format('create policy update_records on public.%I for update to authenticated using (tenant_id=public.am_tenant() and public.am_allowed(%L,true) and public.am_scope(%L,id,%s,%s)) with check (tenant_id=public.am_tenant() and public.am_allowed(%L,true) and public.am_scope(%L,id,%s,%s))',t,t,t,customer_expr,work_expr,t,t,customer_expr,work_expr);
  end if;
  if t='quotation_items' then execute 'create policy delete_items on public.quotation_items for delete to authenticated using(tenant_id=public.am_tenant() and public.am_allowed(''quotation_items'',true))'; end if;
 end loop;
end $$;
alter table public.profiles enable row level security;
create policy read_profiles on public.profiles for select to authenticated using (id=auth.uid() or (tenant_id=public.am_tenant() and public.am_role()<>'engineer'));
alter table public.tenants enable row level security;
create policy read_tenant on public.tenants for select to authenticated using(id=public.am_tenant());
alter table public.roles enable row level security;
create policy read_roles on public.roles for select to authenticated using(true);

create function public.am_log(tenant uuid, title text, entity text, target uuid, customer uuid default null, asset uuid default null, work_order uuid default null) returns void language plpgsql security definer set search_path = '' as $$
begin
 if tenant<>public.am_tenant() and auth.role()<>'service_role' then raise exception 'Unauthorized tenant.'; end if;
 insert into public.activity_log(tenant_id,name,actor_id,customer_id,equipment_id,work_order_id,entity_type,entity_id) values(tenant,title,auth.uid(),customer,asset,work_order,entity,target);
end $$;
-- Workflow functions are atomic and authorize against the stored profile.
create function public.am_dispatch(complaint uuid, engineer uuid, schedule timestamptz) returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.complaints; w uuid; previous_engineer uuid;
begin
 if public.am_role() not in ('super_admin','management','service_manager') then raise exception 'Dispatch permission required.'; end if;
 select * into c from public.complaints where id=complaint and tenant_id=public.am_tenant() for update;
 if not found or c.status in ('Resolved','Closed') then raise exception 'Select an open complaint.'; end if;
 select engineer_id into previous_engineer from public.work_orders where complaint_id=c.id;
 if not exists(select 1 from public.engineers where id=engineer and tenant_id=c.tenant_id and status not in ('Leave','Off Duty')) then raise exception 'Engineer unavailable.'; end if;
 insert into public.work_orders(tenant_id,name,customer_id,site_id,equipment_id,complaint_id,engineer_id,scheduled_at,priority,problem,status)
 values(c.tenant_id,c.name,c.customer_id,c.site_id,c.equipment_id,c.id,engineer,schedule,c.priority,c.problem,'Assigned')
 on conflict(complaint_id) do update set engineer_id=excluded.engineer_id, scheduled_at=excluded.scheduled_at,status='Assigned' where public.work_orders.status not in ('Completed','Cancelled') returning id into w;
 if w is null then raise exception 'A completed or cancelled work order cannot be reassigned.'; end if;
 update public.complaints set engineer_id=engineer,status='Assigned' where id=c.id;
 update public.engineers set status='Assigned' where id=engineer and status<>'On Site';
 if previous_engineer is not null and previous_engineer<>engineer then
  update public.engineers set status=case when exists(select 1 from public.work_orders where engineer_id=previous_engineer and status in ('On Site','In Progress')) then 'On Site' when exists(select 1 from public.work_orders where engineer_id=previous_engineer and status not in ('Completed','Cancelled')) then 'Assigned' else 'Available' end where id=previous_engineer;
 end if;
 insert into public.work_order_activities(tenant_id,name,work_order_id) values(c.tenant_id,'Engineer assigned',w);
 insert into public.notifications(tenant_id,name,recipient_id,entity_type,entity_id) select c.tenant_id,'Work order assigned',profile_id,'work_orders',w from public.engineers where id=engineer and profile_id is not null;
 perform public.am_log(c.tenant_id,'Engineer assigned','work_orders',w,c.customer_id,c.equipment_id,w);
 return w;
end $$;
create function public.am_work(work_order uuid, next_status text, diagnosis_text text default null, work_text text default null, recommendations_text text default null, confirmation_text text default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare w public.work_orders; report uuid; p public.pm_schedules; allowed boolean;
begin
 select * into w from public.work_orders where id=work_order and tenant_id=public.am_tenant() for update;
 if not found or (public.am_role() not in ('super_admin','management','service_manager') and not (public.am_role()='engineer' and public.am_engineer_scope('work_orders',w.id))) then raise exception 'Work order permission required.'; end if;
 allowed:=case w.status when 'Scheduled' then next_status in ('Assigned','Cancelled') when 'Assigned' then next_status in ('Travelling','On Site','Cancelled') when 'Travelling' then next_status in ('On Site','Cancelled') when 'On Site' then next_status in ('In Progress','Cancelled') when 'In Progress' then next_status in ('Waiting Parts','Completed','Cancelled') when 'Waiting Parts' then next_status in ('In Progress','Cancelled') else false end;
 if next_status<>w.status and not allowed then raise exception 'Invalid work order transition: % to %',w.status,next_status; end if;
 if public.am_role()='engineer' and next_status='Cancelled' then raise exception 'A service manager must cancel the job.'; end if;
 if w.status in ('Completed','Cancelled') then raise exception 'This job is already finalized.'; end if;
 if next_status='Completed' and (nullif(trim(coalesce(diagnosis_text,w.diagnosis,'')),'') is null or nullif(trim(coalesce(work_text,w.work_performed,'')),'') is null or nullif(trim(coalesce(confirmation_text,w.customer_confirmation,'')),'') is null) then raise exception 'Diagnosis, work performed and customer confirmation are required.'; end if;
 update public.work_orders set status=next_status,diagnosis=coalesce(diagnosis_text,diagnosis),work_performed=coalesce(work_text,work_performed),recommendations=coalesce(recommendations_text,recommendations),customer_confirmation=coalesce(confirmation_text,customer_confirmation),completed_at=case when next_status='Completed' then now() else null end where id=w.id returning * into w;
 update public.complaints set status=case next_status when 'Travelling' then 'Engineer En Route' when 'On Site' then 'In Progress' when 'In Progress' then 'In Progress' when 'Waiting Parts' then 'Waiting Parts' when 'Completed' then 'Resolved' when 'Cancelled' then 'Acknowledged' else 'Assigned' end where id=w.complaint_id;
 insert into public.work_order_activities(tenant_id,name,work_order_id) values(w.tenant_id,'Job '||lower(next_status),w.id);
 if next_status='Completed' then
  update public.equipment set last_service=public.am_today(),next_service=(public.am_today()+case service_frequency when 'Monthly' then interval '1 month' when 'Semiannual' then interval '6 months' when 'Annual' then interval '1 year' else interval '3 months' end)::date where id=w.equipment_id;
  insert into public.service_reports(tenant_id,name,work_order_id,customer_id,site_id,equipment_id,engineer_id,reported_issue,diagnosis,work_completed,recommendations,customer_confirmation)
  values(w.tenant_id,w.name,w.id,w.customer_id,w.site_id,w.equipment_id,w.engineer_id,w.problem,w.diagnosis,w.work_performed,w.recommendations,w.customer_confirmation) returning id into report;
  for p in select * from public.pm_schedules where work_order_id=w.id loop
   update public.pm_schedules set status='Completed' where id=p.id;
   insert into public.pm_visits(tenant_id,name,schedule_id,work_order_id) values(w.tenant_id,p.name,p.id,w.id);
   update public.amc_contracts set next_visit=coalesce((select min(planned_date) from public.pm_schedules where amc_id=p.amc_id and status<>'Completed'),(public.am_today()+interval '3 months')::date) where id=p.amc_id;
  end loop;
  perform public.am_log(w.tenant_id,'Service report generated','service_reports',report,w.customer_id,w.equipment_id,w.id);
 end if;
 update public.engineers set status=case when exists(select 1 from public.work_orders where engineer_id=w.engineer_id and status in ('On Site','In Progress')) then 'On Site' when exists(select 1 from public.work_orders where engineer_id=w.engineer_id and status not in ('Completed','Cancelled')) then 'Assigned' else 'Available' end where id=w.engineer_id;
 perform public.am_log(w.tenant_id,'Work order '||lower(next_status),'work_orders',w.id,w.customer_id,w.equipment_id,w.id);
 return coalesce(report,w.id);
end $$;
create function public.am_quote(enquiry uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare e public.enquiries; q uuid;
begin
 if not public.am_allowed('quotations',true) then raise exception 'Quotation permission required.'; end if;
 select * into e from public.enquiries where id=enquiry and tenant_id=public.am_tenant() for update;
 if not found then raise exception 'Enquiry not found.'; end if;
 insert into public.quotations(tenant_id,name,customer_id,site_id,enquiry_id,valid_until,followup_date,salesperson_id,notes) values(e.tenant_id,e.name,e.customer_id,e.site_id,e.id,public.am_today()+30,public.am_today()+3,auth.uid(),e.description) returning id into q;
 update public.enquiries set status='Quotation Prepared' where id=e.id;
 perform public.am_log(e.tenant_id,'Quotation created','quotations',q,e.customer_id);
 return q;
end $$;
create function public.am_quote_stage(quotation uuid, next_status text) returns uuid language plpgsql security definer set search_path = '' as $$
declare q public.quotations; revision_id uuid;
begin
 if not public.am_allowed('quotations',true) then raise exception 'Quotation permission required.'; end if;
 select * into q from public.quotations where id=quotation and tenant_id=public.am_tenant() for update;
 if not found then raise exception 'Quotation not found.'; end if;
 if next_status not in ('Ready','Sent','Follow-Up','Revision Requested','Approved','Rejected','Expired','Revision') then raise exception 'Invalid quotation status.'; end if;
 if q.status='Approved' and next_status<>'Revision' then raise exception 'Create a revision of an approved quotation.'; end if;
 if next_status in ('Ready','Sent','Approved') and not exists(select 1 from public.quotation_items where quotation_id=q.id) then raise exception 'Add at least one line item.'; end if;
 if next_status='Revision' then
  insert into public.quotations(tenant_id,name,customer_id,site_id,enquiry_id,valid_until,revision,notes) values(q.tenant_id,q.name,q.customer_id,q.site_id,q.enquiry_id,public.am_today()+30,q.revision+1,q.notes) returning id into revision_id;
  insert into public.quotation_items(tenant_id,name,quotation_id,quantity,unit,unit_price,discount,tax) select tenant_id,name,revision_id,quantity,unit,unit_price,discount,tax from public.quotation_items where quotation_id=q.id;
  perform public.am_log(q.tenant_id,'Quotation revised','quotations',revision_id,q.customer_id); return revision_id;
 end if;
 update public.quotations set status=next_status,sent_at=case when next_status='Sent' then now() else sent_at end,followup_date=case when next_status='Sent' then public.am_today()+3 else followup_date end where id=q.id;
 if next_status='Sent' then insert into public.quotation_followups(tenant_id,name,quotation_id,followup_date) values(q.tenant_id,'Customer response follow-up',q.id,public.am_today()+3); end if;
 if next_status='Approved' then update public.enquiries set status='Won' where id=q.enquiry_id; end if;
 perform public.am_log(q.tenant_id,'Quotation '||lower(next_status),'quotations',q.id,q.customer_id);
 return q.id;
end $$;
create function public.am_project(quotation uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare q public.quotations; project uuid;
begin
 if not public.am_allowed('projects',true) then raise exception 'Project permission required.'; end if;
 select * into q from public.quotations where id=quotation and tenant_id=public.am_tenant() and status='Approved' for update;
 if not found then raise exception 'Approve the quotation first.'; end if;
 insert into public.projects(tenant_id,name,customer_id,site_id,quotation_id,start_date,target_date,manager_id) values(q.tenant_id,q.name,q.customer_id,q.site_id,q.id,public.am_today(),public.am_today()+45,auth.uid()) on conflict(quotation_id) do update set quotation_id=excluded.quotation_id returning id into project;
 perform public.am_log(q.tenant_id,'Project created','projects',project,q.customer_id); return project;
end $$;
create function public.am_pm(schedule uuid, engineer uuid, scheduled timestamptz) returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.pm_schedules; w uuid;
begin
 if public.am_role() not in ('super_admin','management','service_manager') then raise exception 'Maintenance permission required.'; end if;
 select * into p from public.pm_schedules where id=schedule and tenant_id=public.am_tenant() for update;
 if not found or p.status='Completed' then raise exception 'Select an open PM schedule.'; end if;
 if p.work_order_id is not null then return p.work_order_id; end if;
 if not exists(select 1 from public.engineers where id=engineer and tenant_id=p.tenant_id and status not in ('Leave','Off Duty')) then raise exception 'Engineer unavailable.'; end if;
 insert into public.work_orders(tenant_id,name,customer_id,site_id,equipment_id,engineer_id,scheduled_at,status,problem) values(p.tenant_id,p.name,p.customer_id,p.site_id,p.equipment_id,engineer,scheduled,'Assigned','Scheduled preventive maintenance') returning id into w;
 update public.pm_schedules set engineer_id=engineer,work_order_id=w,status='Assigned' where id=p.id;
 update public.engineers set status='Assigned' where id=engineer and status<>'On Site';
 perform public.am_log(p.tenant_id,'PM work order generated','work_orders',w,p.customer_id,p.equipment_id,w); return w;
end $$;

-- Real database aggregates, respecting the caller's RLS and role.
create function public.am_dashboard() returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
 'enquiries',(select count(*) from public.enquiries where status not in ('Won','Lost','Closed')),
 'quotations',(select count(*) from public.quotations where status in ('Sent','Follow-Up','Ready','Revision Requested')),
 'won',(select count(*) from public.quotations where status='Approved'),
 'projects',(select count(*) from public.projects where status in ('Active','Planning')),
 'complaints',(select count(*) from public.complaints where status not in ('Resolved','Closed')),
 'emergency',(select count(*) from public.complaints where priority='Emergency' and status not in ('Resolved','Closed')),
 'jobs',(select count(*) from public.work_orders where (scheduled_at at time zone 'Asia/Muscat')::date=(now() at time zone 'Asia/Muscat')::date and status not in ('Cancelled','Completed')),
 'engineers',(select count(*) from public.engineers where status='Available'),
 'pm',(select count(*) from public.pm_schedules where planned_date between public.am_today() and public.am_today()+14 and status<>'Completed'),
 'warranties',(select count(*) from public.equipment where warranty_end between public.am_today() and public.am_today()+30),
 'amc',(select count(*) from public.amc_contracts where end_date between public.am_today() and public.am_today()+30 and status in ('Active','Expiring')),
 'completed',(select count(*) from public.work_orders where completed_at>=now()-interval '7 days'),
 'complaint_status',(select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from (select status,count(*) n from public.complaints group by status) s),
 'work_activity',(select coalesce(jsonb_agg(row_to_json(s)),'[]'::jsonb) from (select (scheduled_at at time zone 'Asia/Muscat')::date AS "day",count(*) jobs,count(*) filter(where status='Completed') completed from public.work_orders where scheduled_at>=now()-interval '30 days' group by 1 order by 1) s)
 )
$$;

create function public.am_record_activity(entity text, target uuid, title text) returns void language plpgsql security definer set search_path = '' as $$
declare row_data jsonb;
begin
 if entity<>all(array['customers','contacts','sites','engineers','enquiries','enquiry_activities','quotations','quotation_items','quotation_followups','projects','project_engineers','amc_contracts','equipment','amc_equipment','complaints','work_order_readings','work_order_parts','pm_schedules','documents']) or not public.am_allowed(entity,true) then raise exception 'Activity permission required.'; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1 and tenant_id=$2',entity) into row_data using target,public.am_tenant();
 if row_data is null or not public.am_scope(entity,target,(row_data->>'customer_id')::uuid,(row_data->>'work_order_id')::uuid) then raise exception 'Record unavailable.'; end if;
 perform public.am_log(public.am_tenant(),left(title,160),entity,target,(row_data->>'customer_id')::uuid,(row_data->>'equipment_id')::uuid,(row_data->>'work_order_id')::uuid);
end $$;
create function public.am_customer_metrics(targets uuid[]) returns table(id uuid,sites_count bigint,active_projects bigint,equipment_count bigint,amc_count bigint,open_complaints bigint,primary_contact text) language sql stable security invoker set search_path = '' as $$
 select c.id,(select count(*) from public.sites where customer_id=c.id and status='Active'),(select count(*) from public.projects where customer_id=c.id and status in ('Planning','Active')),(select count(*) from public.equipment where customer_id=c.id and status<>'Retired'),(select count(*) from public.amc_contracts where customer_id=c.id and status in ('Active','Expiring') and end_date>=public.am_today()),(select count(*) from public.complaints where customer_id=c.id and status not in ('Resolved','Closed')),(select name from public.contacts where customer_id=c.id and status='Active' order by created_at limit 1) from public.customers c where c.id=any(targets)
$$;
create function public.am_site_metrics(targets uuid[]) returns table(id uuid,equipment_count bigint,open_complaints bigint,active_jobs bigint) language sql stable security invoker set search_path = '' as $$
 select s.id,(select count(*) from public.equipment where site_id=s.id and status<>'Retired'),(select count(*) from public.complaints where site_id=s.id and status not in ('Resolved','Closed')),(select count(*) from public.work_orders where site_id=s.id and status not in ('Completed','Cancelled')) from public.sites s where s.id=any(targets)
$$;
create function public.am_sync_notifications() returns void language plpgsql security definer set search_path = '' as $$
declare tenant uuid:=public.am_tenant();
begin
 if tenant is null or public.am_role()='engineer' then return; end if;
 insert into public.notifications(tenant_id,name,entity_type,entity_id)
 select tenant,'Quotation follow-up due','quotations',id from public.quotations where tenant_id=tenant and status in ('Sent','Follow-Up') and followup_date<=public.am_today()
 union all select tenant,'Emergency complaint needs attention','complaints',id from public.complaints where tenant_id=tenant and priority='Emergency' and status not in ('Resolved','Closed')
 union all select tenant,'Complaint awaiting engineer assignment','complaints',id from public.complaints where tenant_id=tenant and engineer_id is null and status not in ('Resolved','Closed')
 union all select tenant,'Preventive maintenance due','pm_schedules',id from public.pm_schedules where tenant_id=tenant and planned_date<=public.am_today() and status not in ('Completed','Assigned')
 union all select tenant,'AMC coverage expiring','amc_contracts',id from public.amc_contracts where tenant_id=tenant and status in ('Active','Expiring') and end_date between public.am_today() and public.am_today()+30
 union all select tenant,'Equipment warranty expiring','equipment',id from public.equipment where tenant_id=tenant and status<>'Retired' and warranty_end between public.am_today() and public.am_today()+30
 union all select tenant,'Project target approaching','projects',id from public.projects where tenant_id=tenant and status in ('Planning','Active') and target_date between public.am_today() and public.am_today()+7
 on conflict(tenant_id,entity_type,entity_id,name) do nothing;
end $$;
create function public.am_engineer_metrics(targets uuid[]) returns table(id uuid,jobs_today bigint,assigned_jobs bigint,completed_jobs bigint) language sql stable security invoker set search_path = '' as $$
 select e.id,(select count(*) from public.work_orders where engineer_id=e.id and (scheduled_at at time zone 'Asia/Muscat')::date=(now() at time zone 'Asia/Muscat')::date and status<>'Cancelled'),(select count(*) from public.work_orders where engineer_id=e.id and status not in ('Completed','Cancelled')),(select count(*) from public.work_orders where engineer_id=e.id and status='Completed') from public.engineers e where e.id=any(targets)
$$;
create function public.am_set_role(profile uuid,new_role text) returns void language plpgsql security definer set search_path = '' as $$
begin
 if coalesce(public.am_role(),'')<>'super_admin' or new_role not in ('super_admin','management','sales_admin','service_manager','engineer') then raise exception 'Administrator permission required.'; end if;
 if profile=auth.uid() and new_role<>'super_admin' and (select count(*) from public.profiles where tenant_id=public.am_tenant() and role='super_admin')<=1 then raise exception 'The workspace needs at least one Super Admin.'; end if;
 update public.profiles set role=new_role where id=profile and tenant_id=public.am_tenant();
 if not found then raise exception 'Account unavailable.'; end if;
end $$;
create function public.am_complaint_stage(complaint uuid,next_status text) returns void language plpgsql security definer set search_path = '' as $$
declare c public.complaints;
begin
 if public.am_role() not in ('super_admin','management','service_manager') then raise exception 'Complaint permission required.'; end if;
 select * into c from public.complaints where id=complaint and tenant_id=public.am_tenant() for update;
 if not found or next_status not in ('Acknowledged','Waiting Customer','Closed') or (next_status='Closed' and c.status<>'Resolved') or c.status='Closed' then raise exception 'Invalid complaint stage.'; end if;
 update public.complaints set status=next_status where id=c.id;
 perform public.am_log(c.tenant_id,'Complaint '||lower(next_status),'complaints',c.id,c.customer_id,c.equipment_id);
end $$;
create function public.am_read_notification(notification uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 update public.notifications set status='Read' where id=notification and tenant_id=public.am_tenant() and (recipient_id=auth.uid() or (recipient_id is null and public.am_role()<>'engineer')) and public.am_allowed(entity_type);
 if not found then raise exception 'Notification unavailable.'; end if;
end $$;
create function public.am_search(term text) returns table(entity text,id uuid,code text,name text,context text) language sql stable security invoker set search_path = '' as $$
 select * from (
 select 'customers'::text entity,id,code,name,type context from public.customers where name ilike '%'||left(term,100)||'%' or code ilike '%'||left(term,100)||'%'
 union all select 'contacts',id,code,name,role from public.contacts where name ilike '%'||left(term,100)||'%' or code ilike '%'||left(term,100)||'%'
 union all select 'sites',id,code,name,location from public.sites where name ilike '%'||left(term,100)||'%' or code ilike '%'||left(term,100)||'%'
 union all select 'enquiries',id,code,name,status from public.enquiries where name ilike '%'||left(term,100)||'%' or code ilike '%'||left(term,100)||'%'
 union all select 'quotations',id,code,name,status from public.quotations where name ilike '%'||left(term,100)||'%' or code ilike '%'||left(term,100)||'%'
 union all select 'projects',id,code,name,status from public.projects where name ilike '%'||left(term,100)||'%' or code ilike '%'||left(term,100)||'%'
 union all select 'equipment',id,code,name,brand from public.equipment where name ilike '%'||left(term,100)||'%' or code ilike '%'||left(term,100)||'%' or serial_number ilike '%'||left(term,100)||'%'
 union all select 'complaints',id,code,name,priority from public.complaints where name ilike '%'||left(term,100)||'%' or code ilike '%'||left(term,100)||'%'
 union all select 'work_orders',id,code,name,status from public.work_orders where name ilike '%'||left(term,100)||'%' or code ilike '%'||left(term,100)||'%'
 union all select 'engineers',id,code,name,specialization from public.engineers where name ilike '%'||left(term,100)||'%' or code ilike '%'||left(term,100)||'%'
 ) s order by name limit 40
$$;
create function public.am_reset_demo(expected_project text) returns void language plpgsql security definer set search_path = '' as $$
declare demo uuid:='a1000000-0000-4000-8000-000000000001'; t text;
begin
 if not(coalesce(auth.role()='service_role',false) or coalesce(public.am_role()='super_admin' and public.am_tenant()=demo,false)) then raise exception 'Super Admin demo reset permission required.'; end if;
 if expected_project<>'ejtjyxsumvtjtkurldax' or not exists(select 1 from public.tenants where id=demo and is_demo=true and name='AIRMECH ONE Demo') then raise exception 'Dedicated demo target not confirmed.'; end if;
 foreach t in array array['activity_log','notifications','documents','service_reports','pm_visits','pm_schedules','work_order_activities','work_order_parts','work_order_readings','work_orders','complaints','amc_equipment','equipment','amc_contracts','project_engineers','projects','quotation_followups','quotation_items','quotations','enquiry_activities','enquiries','sites','contacts','customers','engineers'] loop
  execute format('delete from public.%I where tenant_id=$1',t) using demo;
 end loop;
end $$;

-- Private storage; object access requires an accessible document row.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('airmech-documents','airmech-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','text/plain']) on conflict(id) do nothing;
create policy airmech_object_read on storage.objects for select to authenticated using(bucket_id='airmech-documents' and exists(select 1 from public.documents d where d.storage_path=storage.objects.name));
create policy airmech_object_insert on storage.objects for insert to authenticated with check(bucket_id='airmech-documents' and (storage.foldername(name))[1]=public.am_tenant()::text and public.am_allowed('documents',true) and (public.am_role()<>'engineer' or ((storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$' and public.am_engineer_scope('work_orders',((storage.foldername(name))[2])::uuid))));
create policy airmech_object_delete on storage.objects for delete to authenticated using(bucket_id='airmech-documents' and owner_id=auth.uid()::text);

-- Restrict function execution: triggers/internal audit helpers are not browser RPCs.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'am_%' loop
  execute format('revoke all on function %s from public, anon',f.signature);
  if f.proname not in ('am_ref','am_validate_links','am_classify','am_guard_records','am_coverage','am_log') then execute format('grant execute on function %s to authenticated, service_role',f.signature); end if;
 end loop;
end $$;
grant usage on schema public to authenticated,service_role;
grant select on public.profiles,public.tenants,public.roles to authenticated;
grant select,insert,update,delete on public.profiles,public.tenants,public.roles to service_role;
commit;
