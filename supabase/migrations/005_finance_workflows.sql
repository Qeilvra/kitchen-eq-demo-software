begin;
-- Public writes accept editable fields only. Totals, actors and lifecycle state are server owned.
create function public.am_finance_save(entity text,target uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare allowed text[]; k text; cols text; expressions text; existing jsonb; result uuid; project uuid; work uuid; invoice uuid; amount numeric;
begin
 if not public.am_finance_allowed(entity,true) or entity in ('payments','receivables','financial_audit') then raise exception 'Financial write permission required.'; end if;
 allowed:=case entity
 when 'invoices' then array['name','customer_id','source_type','project_id','amc_id','work_order_id','invoice_date','due_date','notes']
 when 'invoice_items' then array['name','invoice_id','quantity','unit','unit_price','discount','tax']
 when 'project_financials' then array['name','customer_id','project_id','base_value','estimated_cost','actual_cost_override','recognized_revenue','notes']
 when 'project_variations' then array['name','customer_id','project_id','variation_date','amount','notes']
 when 'amc_financials' then array['name','customer_id','amc_id','contract_value','billing_frequency','renewal_value','notes']
 when 'service_charges' then array['name','customer_id','work_order_id','inspection_fee','labour_charge','parts_charge','other_charges','discount','tax','extra_charge_reason','notes']
 when 'work_order_part_financials' then array['name','customer_id','part_id','unit_cost','unit_sell_price','chargeable','notes']
 when 'cost_records' then array['name','customer_id','project_id','work_order_id','cost_type','cost_date','supplier','quantity','unit_cost','notes'] end;
 if allowed is null or jsonb_typeof(payload)<>'object' or not payload ? 'name' or nullif(trim(payload->>'name'),'') is null then raise exception 'Invalid financial record.'; end if;
 for k in select jsonb_object_keys(payload) loop
  if not k=any(allowed) then raise exception 'Field % is server managed.',k; end if;
  if k=any(array['unit_price','unit_cost','unit_sell_price','quantity','base_value','estimated_cost','actual_cost_override','recognized_revenue','amount','contract_value','renewal_value','inspection_fee','labour_charge','parts_charge','other_charges','discount','tax']) and payload->>k is not null then
   if (payload->>k) !~ (case when k in ('discount','tax') then '^[0-9]{1,3}(\.[0-9]{1,4})?$' else '^[0-9]{1,15}(\.[0-9]{1,3})?$' end) then raise exception 'Invalid decimal precision for %.',k; end if;
   amount:=(payload->>k)::numeric;
   if (k in ('discount','tax') and amount>100) or (k='quantity' and (amount<=0 or amount>999999999.999)) then raise exception 'Invalid %.',k; end if;
  end if;
 end loop;
 if target is not null then
  execute format('select to_jsonb(r) from public.%I r where id=$1 and tenant_id=$2 for update',entity) into existing using target,public.am_tenant();
  if existing is null then raise exception 'Financial record unavailable.'; end if;
  if not public.am_finance_scope(entity,target,(existing->>'project_id')::uuid,(existing->>'work_order_id')::uuid,(existing->>'invoice_id')::uuid) then raise exception 'Financial scope denied.'; end if;
  if entity in ('invoices','project_variations','service_charges') and existing->>'status' not in ('Draft','Recorded') then raise exception 'Create a new draft or use the workflow action.'; end if;
  if entity='cost_records' and existing->>'source_part_id' is not null then raise exception 'Edit the source part pricing instead.'; end if;
  if exists(select 1 from jsonb_each(payload) v where v.key=any(array['project_id','amc_id','work_order_id','invoice_id','part_id','customer_id']) and v.value is distinct from existing->v.key) then raise exception 'Financial record relationships are locked.'; end if;
 end if;
 project:=coalesce((payload->>'project_id')::uuid,(existing->>'project_id')::uuid); work:=coalesce((payload->>'work_order_id')::uuid,(existing->>'work_order_id')::uuid); invoice:=(payload->>'invoice_id')::uuid;
 if entity='work_order_part_financials' then select work_order_id into work from public.work_order_parts where id=(payload->>'part_id')::uuid and tenant_id=public.am_tenant(); end if;
 if work is not null then select project_id into project from public.work_orders where id=work and tenant_id=public.am_tenant(); end if;
 if public.am_role()='project_manager' and not public.am_project_finance_scope(project,true) then raise exception 'Managed-project cost permission required.'; end if;
 if public.am_role()='service_manager' and work is null then raise exception 'Service costs must relate to a work order.'; end if;
 if not public.am_finance_scope(entity,target,project,work,invoice) then raise exception 'Financial scope denied.'; end if;
 if entity='invoice_items' and coalesce((payload->>'discount')::numeric,0)>0 and not public.am_can_approve('discount_approval',coalesce((payload->>'unit_price')::numeric,0)*coalesce((payload->>'quantity')::numeric,1),project) then raise exception 'Discount approval permission required.'; end if;
 if entity='work_order_part_financials' and exists(select 1 from public.service_charges where work_order_id=work and status='Invoiced') then raise exception 'Invoiced service part prices are locked.'; end if;
 if entity='service_charges' and coalesce((payload->>'discount')::numeric,0)>0 and not public.am_can_approve('discount_approval',coalesce((payload->>'inspection_fee')::numeric,0)+coalesce((payload->>'labour_charge')::numeric,0)+coalesce((payload->>'parts_charge')::numeric,0)+coalesce((payload->>'other_charges')::numeric,0),project) then raise exception 'Discount approval permission required.'; end if;
 if entity='cost_records' then payload:=payload||jsonb_build_object('recorded_by',auth.uid()); end if;
 select string_agg(format('%I',key),','),string_agg(format('(jsonb_populate_record(null::public.%I,$1)).%I',entity,key),',') into cols,expressions from jsonb_object_keys(payload) key;
 if target is null then
  execute format('insert into public.%I(%s,tenant_id) select %s,$2 returning id',entity,cols,expressions) into result using payload,public.am_tenant();
 else
  execute format('update public.%I set (%s)=(select %s) where id=$3 and tenant_id=$2 returning id',entity,cols,expressions) into result using payload,public.am_tenant(),target;
 end if;
 return result;
end$$;

create function public.am_invoice_stage(invoice uuid,next_status text,reason text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invoices;
begin
 if not public.am_finance_allowed('invoices',true) then raise exception 'Invoice permission required.'; end if;
 select * into i from public.invoices where id=invoice and tenant_id=public.am_tenant() for update;
 if not found then raise exception 'Invoice unavailable.'; end if;
 if next_status='Issued' then
  if i.status<>'Draft' then raise exception 'Only draft invoices can be issued.'; end if;
  perform public.am_refresh_invoice(i.id); select * into i from public.invoices where id=invoice;
  if i.total<=0 or not public.am_can_approve('invoice_issue',i.total,i.project_id) then raise exception 'A positive total and invoice approval permission are required.'; end if;
  if i.source_type='Service' and not exists(select 1 from public.service_charges s where s.work_order_id=i.work_order_id and s.status in ('Approved','Invoiced') and s.total=i.total) then raise exception 'Approve the service charge and use its calculated amount before issuing.'; end if;
  update public.invoices set status=public.am_invoice_state('Issued',total,paid_amount,due_date),issued_by=auth.uid(),issued_at=now() where id=i.id;
 elsif next_status='Cancelled' then
  if i.status in ('Draft','Cancelled') or i.paid_amount>0 or nullif(trim(reason),'') is null or not public.am_can_approve('invoice_cancellation',i.total,i.project_id) then raise exception 'Cancellation requires approval, a reason and reversal of recorded payments.'; end if;
  update public.invoices set status='Cancelled',cancellation_reason=reason,cancelled_by=auth.uid(),cancelled_at=now() where id=i.id;
  if i.source_type='Service' then update public.service_charges set status='Approved' where work_order_id=i.work_order_id; end if;
 else raise exception 'Invalid invoice action.'; end if;
 return i.id;
end$$;

create function public.am_payment_record(invoice uuid,payload jsonb,request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invoices; previous public.payments; result uuid; fingerprint text; k text;
begin
 if not public.am_finance_allowed('payments',true) then raise exception 'Payment permission required.'; end if;
 if request is null or (payload->>'amount') !~ '^[0-9]{1,15}(\.[0-9]{1,3})?$' or (payload->>'amount')::numeric<=0 then raise exception 'Enter a positive OMR amount with up to three decimals.'; end if;
 for k in select jsonb_object_keys(payload) loop if not k=any(array['amount','payment_date','method','transaction_reference','notes','name']) then raise exception 'Invalid payment field.'; end if; end loop;
 select * into i from public.invoices where id=invoice and tenant_id=public.am_tenant() for update;
 if not found then raise exception 'Invoice unavailable.'; end if;
 fingerprint:=invoice::text||':'||payload::text;
 select * into previous from public.payments where tenant_id=i.tenant_id and request_id=request;
 if found then if previous.request_fingerprint<>fingerprint then raise exception 'Payment request was reused with different data.'; end if; return previous.id; end if;
 insert into public.payments(tenant_id,name,invoice_id,customer_id,amount,payment_date,method,transaction_reference,notes,recorded_by,request_id,request_fingerprint)
 values(i.tenant_id,coalesce(nullif(payload->>'name',''),'Payment for '||i.code),i.id,i.customer_id,(payload->>'amount')::numeric,(payload->>'payment_date')::date,payload->>'method',payload->>'transaction_reference',payload->>'notes',auth.uid(),request,fingerprint) returning id into result;
 return result;
end$$;
create function public.am_payment_adjust(payment uuid,payload jsonb,reverse boolean,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.payments; k text;
begin
 if not public.am_finance_allowed('payments',true) or nullif(trim(reason),'') is null then raise exception 'Payment permission and an audit reason are required.'; end if;
 select * into p from public.payments where id=payment and tenant_id=public.am_tenant();
 if not found then raise exception 'Payment unavailable.'; end if;
 perform 1 from public.invoices where id=p.invoice_id for update;
 select * into p from public.payments where id=payment for update;
 if p.status='Reversed' then raise exception 'This payment has already been reversed.'; end if;
 if reverse then update public.payments set status='Reversed',reversed_by=auth.uid(),reversed_at=now(),reversal_reason=reason where id=p.id;
 else
  for k in select jsonb_object_keys(payload) loop if not k=any(array['amount','payment_date','method','transaction_reference','notes']) then raise exception 'Invalid payment adjustment field.'; end if; end loop;
  if (payload->>'amount') !~ '^[0-9]{1,15}(\.[0-9]{1,3})?$' or (payload->>'amount')::numeric<=0 then raise exception 'Invalid payment amount.'; end if;
  update public.payments set amount=(payload->>'amount')::numeric,payment_date=(payload->>'payment_date')::date,method=payload->>'method',transaction_reference=payload->>'transaction_reference',notes=payload->>'notes',reversal_reason=reason where id=p.id;
 end if; return p.id;
end$$;

create function public.am_variation_stage(variation uuid,next_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.project_variations;
begin
 select * into v from public.project_variations where id=variation and tenant_id=public.am_tenant() for update;
 if not found or not public.am_finance_scope('project_variations',v.id,v.project_id,null,null) then raise exception 'Variation unavailable.'; end if;
 if v.status in ('Approved','Rejected') then raise exception 'Final variations are locked.'; end if;
 if next_status='Submitted' and v.status='Draft' and public.am_finance_allowed('project_variations',true) then update public.project_variations set status='Submitted' where id=v.id;
 elsif next_status in ('Approved','Rejected') and v.status='Submitted' and public.am_can_approve('variation_approval',v.amount,v.project_id) then update public.project_variations set status=next_status,approved_at=case when next_status='Approved' then now() end,approved_by=case when next_status='Approved' then auth.uid() end where id=v.id;
 else raise exception 'Variation approval permission or a submitted variation is required.'; end if; return v.id;
end$$;
create function public.am_service_approve(charge uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.service_charges;
begin
 select * into s from public.service_charges where id=charge and tenant_id=public.am_tenant() for update;
 if not found or s.status<>'Draft' or not public.am_finance_scope('service_charges',s.id,s.project_id,s.work_order_id,null) or not public.am_can_approve('service_charge_approval',s.total,s.project_id) then raise exception 'Service charge approval required.'; end if;
 if public.am_service_classification(s.work_order_id)<>'Paid Service' and s.total>0 and (nullif(trim(s.extra_charge_reason),'') is null or not public.am_can_approve('service_extra_charge',s.total,s.project_id)) then raise exception 'Covered-service extra charge approval required.'; end if;
 update public.service_charges set status='Approved',approved_by=auth.uid(),approved_at=now() where id=s.id; return s.id;
end$$;
create function public.am_service_invoice(work uuid,invoice_date date,due_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.service_charges; w public.work_orders; result uuid;
begin
 if not public.am_finance_allowed('invoices',true) then raise exception 'Invoice permission required.'; end if;
 select * into w from public.work_orders where id=work and tenant_id=public.am_tenant() for update;
 if not found then raise exception 'Service job unavailable.'; end if;
 select id into result from public.invoices where work_order_id=work and status<>'Cancelled'; if found then return result; end if;
 select * into s from public.service_charges where work_order_id=work and tenant_id=public.am_tenant() for update;
 if not found or s.total<=0 or s.status<>'Approved' then raise exception 'Approve a positive service charge first.'; end if;
 if public.am_service_classification(work)<>'Paid Service' and (s.approved_by is null or nullif(trim(s.extra_charge_reason),'') is null) then raise exception 'Covered service requires an authorized extra charge.'; end if;
 insert into public.invoices(tenant_id,name,customer_id,source_type,work_order_id,invoice_date,due_date) values(w.tenant_id,'Service: '||w.code,w.customer_id,'Service',w.id,invoice_date,due_date) returning id into result;
 insert into public.invoice_items(tenant_id,name,invoice_id,quantity,unit_price,discount,tax) values(w.tenant_id,s.name,result,1,s.subtotal,s.discount,s.tax);
 update public.service_charges set status='Invoiced' where id=s.id; return result;
end$$;

-- Safe reads preserve numeric precision and existing RLS, including managed-project grants.
create function public.am_finance_read(entity text,filters jsonb default '{}',page integer default 1,size integer default 20,target uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
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
  elsif key=any(array['customer_id','project_id','amc_id','work_order_id','invoice_id','quotation_id','part_id','entity_id']) then condition:=condition||format(' and r.%I=%L::uuid',key,filters->>key);
  elsif key in ('due_from','due_to') and entity in ('invoices','receivables') then condition:=condition||format(' and r.due_date %s %L::date',case key when 'due_from' then '>=' else '<=' end,filters->>key);
  elsif key='overdue' and entity in ('invoices','receivables') then condition:=condition||' and r.balance>0 and r.due_date<public.am_today() and r.status not in (''Draft'',''Cancelled'')';
  else raise exception 'Invalid finance filter.'; end if;
 end loop;
 execute format('select count(*) from public.%I r where %s',entity,condition) into amount;
 execute format('select coalesce(jsonb_agg(public.am_money_json(to_jsonb(x))),''[]'') from (select r.*%s from public.%I r where %s order by r.created_at desc,r.id limit $1 offset $2) x',case when entity='invoices' then ', public.am_invoice_state(r.status,r.total,r.paid_amount,r.due_date) effective_status' else '' end,entity,condition) into result using least(greatest(size,1),10000),(greatest(page,1)-1)*least(greatest(size,1),10000);
 return jsonb_build_object('records',result,'count',amount);
end$$;

create function public.am_finance_config(action_name text,role_name text,enabled boolean,maximum text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.am_role()<>'super_admin' or role_name='engineer' then raise exception 'Super Admin permission required.'; end if;
 if maximum is not null and maximum !~ '^[0-9]{1,15}(\.[0-9]{1,3})?$' then raise exception 'Invalid approval maximum.'; end if;
 update public.approval_rules set enabled=am_finance_config.enabled,max_amount=maximum::numeric where tenant_id=public.am_tenant() and action=action_name and role=role_name;
 if not found then raise exception 'Unknown approval rule.'; end if;
 insert into public.financial_audit(tenant_id,actor_id,action,entity_type,entity_id,after_data) values(public.am_tenant(),auth.uid(),'Approval rule changed','approval_rules',auth.uid(),jsonb_build_object('action',action_name,'role',role_name,'enabled',enabled,'maximum',maximum));
end$$;
create function public.am_project_finance_grant(project uuid,profile uuid,can_view boolean,can_record_costs boolean,can_approve boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.am_role()<>'super_admin' or not exists(select 1 from public.projects p join public.profiles u on u.id=profile and u.tenant_id=p.tenant_id where p.id=project and p.tenant_id=public.am_tenant() and p.manager_id=u.id and u.role='project_manager') then raise exception 'Select the assigned Project Manager; Super Admin permission required.'; end if;
 insert into public.project_finance_access values(public.am_tenant(),profile,project,can_view,can_record_costs,can_approve) on conflict(profile_id,project_id) do update set can_view=excluded.can_view,can_record_costs=excluded.can_record_costs,can_approve=excluded.can_approve;
 insert into public.financial_audit(tenant_id,actor_id,action,entity_type,entity_id,project_id,after_data) values(public.am_tenant(),auth.uid(),'Project financial access changed','project_finance_access',profile,project,jsonb_build_object('view',can_view,'costs',can_record_costs,'approve',can_approve));
end$$;
create or replace function public.am_set_role(profile uuid,new_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(public.am_role(),'')<>'super_admin' or not exists(select 1 from public.roles where name=new_role) then raise exception 'Administrator permission required.'; end if;
 perform 1 from public.tenants where id=public.am_tenant() for update;
 if new_role<>'super_admin' and exists(select 1 from public.profiles where id=profile and role='super_admin') and (select count(*) from public.profiles where tenant_id=public.am_tenant() and role='super_admin')<=1 then raise exception 'The workspace needs at least one Super Admin.'; end if;
 update public.profiles set role=new_role where id=profile and tenant_id=public.am_tenant(); if not found then raise exception 'Account unavailable.'; end if;
end$$;
create or replace function public.am_engineer_options(targets uuid[] default null) returns table(id uuid,name text,code text,status text) language sql stable security definer set search_path='' as $$
 select e.id,e.name,e.code,e.status from public.engineers e where e.tenant_id=public.am_tenant()
 and (public.am_role() in ('owner_director','super_admin','management','sales_admin','accounts_finance','service_manager') or (public.am_role()='engineer' and e.profile_id=auth.uid()) or (public.am_role()='project_manager' and exists(select 1 from public.project_engineers t join public.projects p on p.id=t.project_id where t.engineer_id=e.id and p.manager_id=auth.uid())))
 and (targets is null or e.id=any(targets)) order by e.name limit 200
$$;
-- Approval permission is configurable independently of the commercial CRUD permission.
create function public.am_quote_approval_guard() returns trigger language plpgsql security definer set search_path='' as $$begin if auth.role()<>'service_role' and new.status='Approved' and old.status<>'Approved' and not public.am_can_approve('quotation_approval',new.grand_total) then raise exception 'Quotation approval permission required.'; end if; return new; end$$;
create trigger quotation_approval before update of status on public.quotations for each row execute function public.am_quote_approval_guard();

-- Internal privileged helpers are callable by triggers only, never by arbitrary browser RPC.
do $$declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['am_seed_approval_rules','am_new_tenant_approvals','am_finance_code','am_finance_audit_row','am_refresh_quotation','am_quotation_items_refresh','am_quote_money_guard','am_quote_item_guard','am_refresh_invoice','am_invoice_refresh_trigger','am_invoice_item_guard','am_payment_guard','am_financial_parent','am_amc_finance_parent','am_invoice_links','am_initialize_project_financials','am_initialize_amc_financials','am_guard_service_charge','am_refresh_parts_money','am_part_cost_trigger','am_service_parts_initial','am_quote_approval_guard']) loop execute format('revoke all on function %s from public,anon,authenticated',f.signature); end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['am_finance_save','am_invoice_stage','am_payment_record','am_payment_adjust','am_variation_stage','am_service_approve','am_service_invoice','am_finance_read','am_finance_config','am_project_finance_grant','am_project_finance_scope','am_finance_allowed','am_finance_scope','am_managed_project','am_project_operational_scope','am_can_approve','am_service_classification']) loop execute format('revoke all on function %s from public,anon; grant execute on function %s to authenticated,service_role',f.signature,f.signature); end loop;
end$$;
create function public.am_finance_delete_item(item uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invoice_items;
begin
 if not public.am_finance_allowed('invoice_items',true) then raise exception 'Invoice item permission required.'; end if;
 select * into i from public.invoice_items where id=item and tenant_id=public.am_tenant();if not found then raise exception 'Invoice item unavailable.'; end if;
 perform 1 from public.invoices where id=i.invoice_id for update;
 delete from public.invoice_items where id=i.id;return i.invoice_id;
end$$;
revoke all on function public.am_finance_delete_item(uuid) from public,anon;grant execute on function public.am_finance_delete_item(uuid) to authenticated,service_role;
-- Extend the existing explicitly confirmed, dedicated-demo reset in dependency order.
create or replace function public.am_reset_demo(expected_project text) returns void language plpgsql security definer set search_path='' as $$
declare demo uuid:='a1000000-0000-4000-8000-000000000001';t text;
begin
 if not(coalesce(auth.role()='service_role',false) or coalesce(public.am_role()='super_admin' and public.am_tenant()=demo,false)) then raise exception 'Super Admin demo reset permission required.'; end if;
 if expected_project<>'ejtjyxsumvtjtkurldax' or not exists(select 1 from public.tenants where id=demo and is_demo=true and name='AIRMECH ONE Demo') then raise exception 'Dedicated demo target not confirmed.'; end if;
 update public.invoices set status='Draft' where tenant_id=demo;
 update public.quotations set status='Draft' where tenant_id=demo;
 foreach t in array array['project_finance_access','payments','invoice_items','invoices','cost_records','work_order_part_financials','service_charges','project_variations','project_financials','amc_financials','financial_document_counters','activity_log','notifications','documents','service_reports','pm_visits','pm_schedules','work_order_activities','work_order_parts','work_order_readings','work_orders','complaints','amc_equipment','equipment','amc_contracts','project_engineers','projects','quotation_followups','quotation_items','quotations','enquiry_activities','enquiries','sites','contacts','customers','engineers'] loop
  delete from public.financial_audit where tenant_id=demo;
  execute format('delete from public.%I where tenant_id=$1',t) using demo;
 end loop;
 delete from public.financial_audit where tenant_id=demo;
end$$;
-- Revoke actual internal trigger names as well as the mutation helpers above.
do $$declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['am_tenant_finance_defaults','am_quote_totals_trigger','am_guard_quote_money','am_invoice_rollup','am_guard_invoice_item','am_guard_payment']) loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);end loop;end$$;
commit;
