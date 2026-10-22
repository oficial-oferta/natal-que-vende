-- Natal que Vende: entrega paga com autenticação real e recursos privados.
-- Execute no SQL Editor do Supabase após criar seu projeto.
-- NÃO execute em um banco usado por outras aplicações sem revisão.
create table if not exists public.access_orders (
  order_id text primary key,
  email text not null check (email = lower(trim(email))),
  product_id text not null,
  status text not null check (status in ('paid','refunded','chargeback')),
  invite_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.access_orders enable row level security;
revoke all on public.access_orders from anon, authenticated;
-- Nenhuma política SELECT para compradores; os pedidos são consultados só no servidor.

create or replace function public.has_natal_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.access_orders o
    join auth.users u on lower(u.email) = o.email
    where u.id = (select auth.uid())
      and o.status = 'paid'
  );
$$;
revoke all on function public.has_natal_access() from public, anon;
grant execute on function public.has_natal_access() to authenticated;

-- Idempotência por pedido. Reembolso/chargeback não pode ser revertido por
-- reenvio tardio de um webhook "purchase_approved".
create or replace function public.ingest_cakto_order(
  p_order_id text, p_email text, p_product_id text, p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('paid','refunded','chargeback')
    or trim(coalesce(p_order_id,'')) = ''
    or trim(coalesce(p_product_id,'')) = ''
    or trim(coalesce(p_email,'')) = ''
  then
    raise exception 'Evento inválido';
  end if;
  insert into public.access_orders (order_id, email, product_id, status)
  values (p_order_id, lower(trim(p_email)), p_product_id, p_status)
  on conflict (order_id) do update
    set status = case
      when public.access_orders.status in ('refunded','chargeback')
       and excluded.status = 'paid' then public.access_orders.status
      else excluded.status
    end,
    updated_at = now();
end;
$$;
revoke all on function public.ingest_cakto_order(text,text,text,text) from public, anon, authenticated;
grant execute on function public.ingest_cakto_order(text,text,text,text) to service_role;

create table if not exists public.resources (
  id bigint generated always as identity primary key,
  module_no smallint not null check (module_no between 1 and 5),
  title text not null,
  resource_kind text not null check (resource_kind in ('pdf','xlsx','canva','other')),
  description text,
  storage_path text,
  external_url text,
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint path_or_link check (
    (resource_kind = 'canva' and external_url is not null and storage_path is null)
    or (resource_kind <> 'canva' and storage_path is not null and external_url is null)
  )
);
create index if not exists idx_resources_module on public.resources(module_no,sort_order);
alter table public.resources enable row level security;
revoke all on public.resources from anon;
grant select on public.resources to authenticated;
drop policy if exists "Apenas compradores veem materiais" on public.resources;
create policy "Apenas compradores veem materiais"
on public.resources
for select to authenticated
using (published = true and (select public.has_natal_access()));

insert into storage.buckets (id,name,public)
values ('natal-pago','natal-pago',false)
on conflict (id) do update set public = false;
-- Sem políticas públicas para download, listagem ou upload.
drop policy if exists "Compradores podem baixar materiais publicados" on storage.objects;
create policy "Compradores podem baixar materiais publicados"
on storage.objects
for select to authenticated
using (
  bucket_id = 'natal-pago'
  and (select public.has_natal_access())
  and exists (
    select 1 from public.resources r
    where r.storage_path = storage.objects.name
      and r.published = true
  )
);

-- Os arquivos pagos serão inseridos no Storage privado pelo administrador.
-- Depois crie uma linha por recurso com published=true para liberar.
-- Exemplos (NÃO executados automaticamente):
-- insert into public.resources (module_no,title,resource_kind,storage_path,published,sort_order)
-- values (1,'Comece por Aqui — Guia PDF','pdf','01/comece-por-aqui.pdf',true,1);
--
-- Produto 04: o external_url DEVE ser Link de Modelo oficial (cópia), não
-- o link administrativo de edição. Armazene o guia privado como PDF.
-- insert into public.resources (module_no,title,resource_kind,storage_path,published)
-- values (4,'Guia de acesso aos modelos','pdf','04/guia-de-acesso.pdf',true);
--
-- As URLs assinadas de download são temporárias (60 s no portal).
-- Uma URL já assinada só expira ao final do prazo, mesmo após estorno.
