begin;
create function public.am_financial_overview(customer uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; trend jsonb; aging jsonb;
begin
 if public.am_role() not in ('owner_director','super_admin','management','accounts_finance','sales_admin') or (public.am_role()='sales_admin' and customer is null) then raise exception 'Company finance permission required.'; end if;
 select public.am_money_json(jsonb_build_object(
 'customers',(select count(*) from public.customers where customer is null or id=customer),
 'open_enquiries',(select count(*) from public.enquiries where status not in ('Won','Lost','Closed') and (customer is null or customer_id=customer)),
 'active_projects',(select count(*) from public.projects where status='Active' and (customer is null or customer_id=customer)),
 'open_cases',(select count(*) from public.complaints where status not in ('Resolved','Closed') and (customer is null or customer_id=customer)),
 'total_quoted',(select coalesce(sum(grand_total),0) from public.quotations where customer is null or customer_id=customer),
 'pipeline',(select coalesce(sum(grand_total),0) from public.quotations where status not in ('Approved','Rejected','Expired') and (customer is null or customer_id=customer)),
 'approved_value',(select coalesce(sum(grand_total),0) from public.quotations where status='Approved' and (customer is null or customer_id=customer)),
 'conversion',(select case when count(*)>0 then round(count(*) filter(where status='Approved')::numeric/count(*)*100,1) else null end from public.quotations where customer is null or customer_id=customer),
 'active_project_value',(select coalesce(sum(project_revenue),0) from public.project_financial_summary where project_status='Active' and (customer is null or customer_id=customer)),
 'invoiced',(select coalesce(sum(total),0) from public.invoices where status not in ('Draft','Cancelled') and (customer is null or customer_id=customer)),
 'collected',(select coalesce(sum(amount),0) from public.payments where status='Recorded' and (customer is null or customer_id=customer)),
 'outstanding',(select coalesce(sum(balance),0) from public.receivables where customer is null or customer_id=customer),
 'overdue_amount',(select coalesce(sum(balance),0) from public.receivables where due_date<public.am_today() and (customer is null or customer_id=customer)),
 'overdue_invoices',(select count(*) from public.receivables where due_date<public.am_today() and (customer is null or customer_id=customer)),
 'invoices_due',(select count(*) from public.receivables where due_date<=public.am_today()+30 and (customer is null or customer_id=customer)),
 'month_payments',(select coalesce(sum(amount),0) from public.payments where status='Recorded' and payment_date>=date_trunc('month',public.am_today())::date and (customer is null or customer_id=customer)),
 'amc_contracts',(select count(*) from public.amc_contracts where status in ('Active','Expiring') and end_date>=public.am_today() and (customer is null or customer_id=customer)),
 'amc_value',(select coalesce(sum(contract_value),0) from public.amc_financial_summary where contract_status in ('Active','Expiring') and end_date>=public.am_today() and (customer is null or customer_id=customer)),
 'amc_expiring',(select count(*) from public.amc_contracts where status in ('Active','Expiring') and end_date between public.am_today() and public.am_today()+30 and (customer is null or customer_id=customer))
 )) into result;
 select coalesce(jsonb_agg(public.am_money_json(to_jsonb(t)) order by t."month"),'[]') into trend from (
 select to_char(m,'YYYY-MM') as "month",
 coalesce((select sum(total) from public.invoices where status not in ('Draft','Cancelled') and invoice_date>=m::date and invoice_date<(m+interval '1 month')::date and (customer is null or customer_id=customer)),0) invoiced,
 coalesce((select sum(amount) from public.payments where status='Recorded' and payment_date>=m::date and payment_date<(m+interval '1 month')::date and (customer is null or customer_id=customer)),0) collected
 from generate_series(date_trunc('month',public.am_today())-interval '5 months',date_trunc('month',public.am_today()),interval '1 month') m) t;
 select coalesce(jsonb_agg(public.am_money_json(to_jsonb(a)) order by a.position),'[]') into aging from (
 select b.label bucket,b.position,count(r.id) invoice_count,coalesce(sum(r.balance),0) amount from (values('Current',1),('1–30 Days',2),('31–60 Days',3),('61–90 Days',4),('90+ Days',5)) b(label,position)
 left join public.receivables r on r.aging_bucket=b.label and (customer is null or r.customer_id=customer) group by b.label,b.position) a;
 return result||jsonb_build_object('trend',trend,'aging',aging);
end$$;
revoke all on function public.am_financial_overview(uuid) from public,anon;
grant execute on function public.am_financial_overview(uuid) to authenticated,service_role;
commit;
