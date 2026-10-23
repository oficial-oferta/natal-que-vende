-- Owner-only ingestion into private paid assets bucket.
-- Security: temporary preview permission is not a paid order.
-- The UUID is the verified, previously invited owner account.
create or replace function public.is_nqv_admin()
returns boolean language sql stable security definer set search_path=''
as $fn$
  select (select auth.uid())='67e0aeb1-bfe8-41cb-b3d6-19d1df7cb775'::uuid
    and exists(
      select 1 from nqv_internal.preview_access p
      where p.user_id=(select auth.uid()) and p.expires_at>now()
    );
$fn$;
revoke all on function public.is_nqv_admin() from public,anon;
grant execute on function public.is_nqv_admin() to authenticated;

drop policy if exists "Admin NQV may view drafts" on public.resources;
create policy "Admin NQV may view drafts" on public.resources
for select to authenticated using ((select public.is_nqv_admin()));

drop policy if exists "Admin NQV may publish after upload" on public.resources;
create policy "Admin NQV may publish after upload" on public.resources
for update to authenticated
using ((select public.is_nqv_admin()))
with check ((select public.is_nqv_admin()));

-- Only owner account and only paths pre-registered in the resources manifest.
drop policy if exists "Admin NQV may upload registered materials" on storage.objects;
create policy "Admin NQV may upload registered materials" on storage.objects
for insert to authenticated
with check (
 bucket_id='natal-pago' and (select public.is_nqv_admin())
 and exists(select 1 from public.resources r where r.storage_path=storage.objects.name)
);
drop policy if exists "Admin NQV may read draft materials" on storage.objects;
create policy "Admin NQV may read draft materials" on storage.objects
for select to authenticated
using (
 bucket_id='natal-pago' and (select public.is_nqv_admin())
 and exists(select 1 from public.resources r where r.storage_path=storage.objects.name)
);
drop policy if exists "Admin NQV may update registered materials" on storage.objects;
create policy "Admin NQV may update registered materials" on storage.objects
for update to authenticated
using (
 bucket_id='natal-pago' and (select public.is_nqv_admin())
 and exists(select 1 from public.resources r where r.storage_path=storage.objects.name)
)
with check (
 bucket_id='natal-pago' and (select public.is_nqv_admin())
 and exists(select 1 from public.resources r where r.storage_path=storage.objects.name)
);
