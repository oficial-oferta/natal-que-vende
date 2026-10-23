-- Separate paid entitlements for course and checkout extras.
-- Missing Cakto product IDs intentionally remain NULL until their real products exist.
create table if not exists public.natal_offers (
 slug text primary key check(slug in ('curso-principal','recheios-premium','kits-premium')),
 kind text not null check (kind in ('main','premium')),
 title text not null,
 price_label text not null,
 cakto_product_id text unique,
 checkout_url text check (checkout_url is null or checkout_url ~ '^https://'),
 active boolean not null default true,
 sort_order smallint not null default 0
);
alter table public.natal_offers enable row level security;
revoke all on public.natal_offers from public,anon,authenticated;
grant select on public.natal_offers to authenticated;
drop policy if exists "Signed-in users see offer catalog" on public.natal_offers;
create policy "Signed-in users see offer catalog" on public.natal_offers
for select to authenticated using ((select auth.uid()) is not null);
insert into public.natal_offers (slug,kind,title,price_label,sort_order) values
 ('curso-principal','main','Natal que Vende — 5 módulos','R$ 19,90',1),
 ('recheios-premium','premium','Segredos do Recheio Premium','R$ 9,90',2),
 ('kits-premium','premium','Natal que Vende PRO — Presentes de Alto Valor','R$ 39,90',3)
on conflict(slug) do nothing;

-- Update previously broad "any paid order" access rule: only the main product unlocks modules 01–05.
create or replace function public.has_natal_access()
returns boolean language sql stable security definer set search_path=''
as $fn$
 select (select auth.uid()) is not null and (
  public.is_nqv_admin()
  or exists(
   select 1 from public.access_orders o
   join public.natal_offers offer on offer.cakto_product_id=o.product_id
   join auth.users u on lower(u.email)=o.email
   where u.id=(select auth.uid()) and o.status='paid'
    and offer.slug='curso-principal' and offer.kind='main' and offer.active=true
  )
  or exists(
   select 1 from nqv_internal.preview_access p
   where p.user_id=(select auth.uid()) and p.expires_at>now()
  )
 );
$fn$;
revoke all on function public.has_natal_access() from public,anon;
grant execute on function public.has_natal_access() to authenticated;

create or replace function public.has_natal_premium(p_slug text)
returns boolean language sql stable security definer set search_path=''
as $fn$
 select (select auth.uid()) is not null and (
  public.is_nqv_admin()
  or exists(
   select 1 from public.access_orders o
   join public.natal_offers offer on offer.cakto_product_id=o.product_id
   join auth.users u on lower(u.email)=o.email
   where u.id=(select auth.uid()) and o.status='paid'
    and offer.slug=p_slug and offer.kind='premium' and offer.active=true
  )
 );
$fn$;
revoke all on function public.has_natal_premium(text) from public,anon;
grant execute on function public.has_natal_premium(text) to authenticated;

create table if not exists public.premium_resources (
 id bigint generated always as identity primary key,
 offer_slug text not null references public.natal_offers(slug),
 title text not null,
 resource_kind text not null check(resource_kind in ('pdf','xlsx')),
 storage_path text not null unique,
 sort_order smallint not null default 1,
 published boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.premium_resources enable row level security;
revoke all on public.premium_resources from public,anon,authenticated;
grant select on public.premium_resources to authenticated;
drop policy if exists "Purchased premiums can view their files" on public.premium_resources;
create policy "Purchased premiums can view their files" on public.premium_resources
for select to authenticated
using(published=true and public.has_natal_premium(offer_slug));
drop policy if exists "Owner can inspect premium file drafts" on public.premium_resources;
create policy "Owner can inspect premium file drafts" on public.premium_resources
for select to authenticated using((select public.is_nqv_admin()));
drop policy if exists "Owner can publish premium files" on public.premium_resources;
create policy "Owner can publish premium files" on public.premium_resources
for update to authenticated
using((select public.is_nqv_admin()))
with check((select public.is_nqv_admin()));
grant update(published) on public.premium_resources to authenticated;

insert into public.premium_resources(offer_slug,title,resource_kind,storage_path,sort_order)
values
 ('recheios-premium','Segredos do Recheio Premium — 12 receitas','pdf','premium/recheios/segredos-do-recheio-premium.pdf',1),
 ('kits-premium','Natal que Vende PRO — 8 kits premium','pdf','premium/kits/presentes-de-alto-valor.pdf',1),
 ('kits-premium','Calculadora de Kits Premium','xlsx','premium/kits/calculadora-de-kits.xlsx',2)
on conflict(storage_path) do nothing;

drop policy if exists "Buyers download purchased premium files" on storage.objects;
create policy "Buyers download purchased premium files" on storage.objects
for select to authenticated
using(bucket_id='natal-pago' and exists(
 select 1 from public.premium_resources r
 where r.storage_path=storage.objects.name and r.published=true
 and public.has_natal_premium(r.offer_slug)
));
drop policy if exists "Owner may upload known premium files" on storage.objects;
create policy "Owner may upload known premium files" on storage.objects
for insert to authenticated
with check(bucket_id='natal-pago' and (select public.is_nqv_admin())
and exists(select 1 from public.premium_resources r where r.storage_path=storage.objects.name));
drop policy if exists "Owner may read premium file drafts" on storage.objects;
create policy "Owner may read premium file drafts" on storage.objects
for select to authenticated
using(bucket_id='natal-pago' and (select public.is_nqv_admin())
and exists(select 1 from public.premium_resources r where r.storage_path=storage.objects.name));
