begin;
-- Customer creation/update events belong in Customer 360 and follow its lifecycle.
create or replace function public.am_record_activity(entity text, target uuid, title text) returns void language plpgsql security definer set search_path = '' as $$
declare row_data jsonb; customer uuid;
begin
 if entity<>all(array['customers','contacts','sites','engineers','enquiries','enquiry_activities','quotations','quotation_items','quotation_followups','projects','project_engineers','amc_contracts','equipment','amc_equipment','complaints','work_order_readings','work_order_parts','pm_schedules','documents']) or not public.am_allowed(entity,true) then raise exception 'Activity permission required.'; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1 and tenant_id=$2',entity) into row_data using target,public.am_tenant();
 if row_data is null or not public.am_scope(entity,target,(row_data->>'customer_id')::uuid,(row_data->>'work_order_id')::uuid) then raise exception 'Record unavailable.'; end if;
 customer:=case when entity='customers' then target else (row_data->>'customer_id')::uuid end;
 perform public.am_log(public.am_tenant(),left(title,160),entity,target,customer,(row_data->>'equipment_id')::uuid,(row_data->>'work_order_id')::uuid);
end $$;
update public.activity_log a set customer_id=a.entity_id where a.entity_type='customers' and a.customer_id is null and exists(select 1 from public.customers c where c.id=a.entity_id and c.tenant_id=a.tenant_id);
commit;
