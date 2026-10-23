-- Resource privacy enforced on the database as well as the front-end.
create or replace function public.can_access_natal_module(p_module_no integer)
returns boolean language sql stable security definer set search_path=''
as $fn$
  select (select auth.uid()) is not null
   and (select public.has_natal_access())
   and p_module_no between 1 and 5
   and (
      p_module_no=1
      or exists(
        select 1 from public.module_progress p
        where p.user_id=(select auth.uid()) and p.module_no=p_module_no-1
      )
   );
$fn$;
revoke all on function public.can_access_natal_module(integer) from public,anon;
grant execute on function public.can_access_natal_module(integer) to authenticated;

drop policy if exists "Apenas compradores veem materiais" on public.resources;
create policy "Apenas compradores veem materiais" on public.resources
 for select to authenticated
 using (published=true and public.can_access_natal_module(module_no));

drop policy if exists "Compradores podem baixar materiais publicados" on storage.objects;
create policy "Compradores podem baixar materiais publicados" on storage.objects
 for select to authenticated
 using (
  bucket_id='natal-pago'
  and exists (
   select 1 from public.resources r
   where r.storage_path=storage.objects.name
     and r.published=true
     and public.can_access_natal_module(r.module_no)
  )
 );
