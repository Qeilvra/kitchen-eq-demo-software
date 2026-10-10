begin;
-- Supabase default privileges add REFERENCES/TRIGGER/TRUNCATE even where the
-- application explicitly grants only SELECT or CRUD. Remove these inherited
-- extras so hosted permissions match the migration-defined application grants.
-- No records are changed; existing RLS and business access remain in force.
do $$declare t text; begin
 foreach t in array array[
  'tenants','roles','profiles','customers','contacts','sites','engineers','enquiries','enquiry_activities',
  'quotations','quotation_items','quotation_followups','projects','project_engineers','amc_contracts',
  'equipment','amc_equipment','complaints','work_orders','work_order_readings','work_order_parts',
  'work_order_activities','pm_schedules','pm_visits','service_reports','documents','notifications','activity_log',
  'project_financials','project_variations','amc_financials','invoices','invoice_items','payments',
  'service_charges','work_order_part_financials','cost_records','financial_audit','approval_rules',
  'project_finance_access','financial_document_counters','receivables','project_financial_summary',
  'amc_financial_summary','paid_service_collections'
 ] loop
  execute format('revoke references,trigger,truncate on public.%I from anon,authenticated',t);
  if t<>all(array['financial_audit','approval_rules','project_finance_access','financial_document_counters']) then
   execute format('revoke references,trigger,truncate on public.%I from service_role',t);
  end if;
 end loop;
end$$;
commit;
