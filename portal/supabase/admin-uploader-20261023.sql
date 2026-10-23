-- Permanent owner role, separately from temporary preview permission.
create table if not exists nqv_internal.owner_accounts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
revoke all on nqv_internal.owner_accounts from public,anon,authenticated;
insert into nqv_internal.owner_accounts(user_id)
select id from auth.users where email='acesso.natalquevende@gmail.com'
  and email_confirmed_at is not null
on conflict do nothing;
create or replace function public.is_nqv_admin()
returns boolean language sql stable security definer set search_path=''
as $fn$
 select (select auth.uid()) is not null and exists(
  select 1 from nqv_internal.owner_accounts a where a.user_id=(select auth.uid())
 );
$fn$;
revoke all on function public.is_nqv_admin() from public,anon;
grant execute on function public.is_nqv_admin() to authenticated;

create or replace function public.has_natal_access()
returns boolean language sql stable security definer set search_path=''
as $fn$
 select (select auth.uid()) is not null and (
  public.is_nqv_admin()
  or exists(
    select 1 from public.access_orders o join auth.users u on lower(u.email)=o.email
    where u.id=(select auth.uid()) and o.status='paid'
  )
  or exists(
    select 1 from nqv_internal.preview_access p
    where p.user_id=(select auth.uid()) and p.expires_at>now()
  )
 );
$fn$;
revoke all on function public.has_natal_access() from public,anon;
grant execute on function public.has_natal_access() to authenticated;

-- Additional admin SELECT of staged resources; buyers still follow published + unlock rules.
drop policy if exists "Owner reviews staged materials" on public.resources;
create policy "Owner reviews staged materials" on public.resources for select to authenticated
using ((select public.is_nqv_admin()));
drop policy if exists "Owner publishes registered materials" on public.resources;
create policy "Owner publishes registered materials" on public.resources for update to authenticated
using ((select public.is_nqv_admin()))
with check ((select public.is_nqv_admin()));

-- Upload only the five pre-declared paths; never turn the bucket public.
drop policy if exists "Owner uploads registered materials" on storage.objects;
create policy "Owner uploads registered materials" on storage.objects for insert to authenticated
with check (bucket_id='natal-pago' and (select public.is_nqv_admin())
and exists(select 1 from public.resources r where r.storage_path=storage.objects.name));
drop policy if exists "Owner reads staged materials" on storage.objects;
create policy "Owner reads staged materials" on storage.objects for select to authenticated
using (bucket_id='natal-pago' and (select public.is_nqv_admin())
and exists(select 1 from public.resources r where r.storage_path=storage.objects.name));
