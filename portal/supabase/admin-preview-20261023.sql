-- Admin preview for a known, already-confirmed Natál que Vende account.
-- Never forge a purchase record for a test account.
-- The privilege expires automatically; not inherited by any other account.
create schema if not exists nqv_internal;
revoke all on schema nqv_internal from public, anon, authenticated;
create table if not exists nqv_internal.preview_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 purpose text not null default 'Preview dos cinco módulos antes do checkout',
 created_at timestamptz not null default now()
);
revoke all on nqv_internal.preview_access from public, anon, authenticated;
create or replace function public.has_natal_access()
returns boolean
language sql stable security definer
set search_path=''
as $fn$
  select (auth.uid() is not null) and (
    exists (
      select 1
      from public.access_orders o
      join auth.users u on lower(u.email)=o.email
      where u.id=(select auth.uid()) and o.status='paid'
    )
    or exists (
      select 1 from nqv_internal.preview_access p
      where p.user_id=(select auth.uid()) and p.expires_at>now()
    )
  );
$fn$;
revoke all on function public.has_natal_access() from public, anon;
grant execute on function public.has_natal_access() to authenticated;
insert into nqv_internal.preview_access (user_id, expires_at)
select id, '2026-11-06T23:59:59-03:00'::timestamptz
from auth.users
where lower(email)='acesso.natalquevende@gmail.com'
  and email_confirmed_at is not null
on conflict (user_id) do update
set expires_at=excluded.expires_at;
