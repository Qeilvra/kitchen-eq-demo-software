begin;
-- Minimal identity references for project assignment and printed service reports.
-- Full engineer records and job data retain their existing RLS restrictions.
create function public.am_engineer_options(targets uuid[] default null)
returns table(id uuid,name text,code text,status text)
language sql stable security definer set search_path = '' as $$
 select e.id,e.name,e.code,e.status from public.engineers e
 where e.tenant_id=public.am_tenant()
 and (public.am_role() in ('super_admin','management','sales_admin','service_manager') or (public.am_role()='engineer' and e.profile_id=auth.uid()))
 and (targets is null or e.id=any(targets))
 order by e.name limit 200
$$;
revoke all on function public.am_engineer_options(uuid[]) from public,anon;
grant execute on function public.am_engineer_options(uuid[]) to authenticated,service_role;
commit;
