-- Authenticated, per-account progression. No client-side unlock flags.
create table if not exists public.module_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 module_no smallint not null check (module_no between 1 and 5),
 completed_at timestamptz not null default now(),
 primary key (user_id,module_no)
);
alter table public.module_progress enable row level security;
revoke all on public.module_progress from public,anon,authenticated;
grant select on public.module_progress to authenticated;

drop policy if exists "Read own module progress" on public.module_progress;
create policy "Read own module progress" on public.module_progress
 for select to authenticated
 using (user_id=(select auth.uid()) and (select public.has_natal_access()));

-- Idempotent progress advancement; cannot skip a module or mark others' accounts.
create or replace function public.complete_natal_module(p_module_no integer)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_user uuid;
begin
 v_user := (select auth.uid());
 if v_user is null or not (select public.has_natal_access()) then
   raise exception 'Acesso não autorizado' using errcode='42501';
 end if;
 if p_module_no is null or p_module_no<1 or p_module_no>5 then
   raise exception 'Módulo inválido' using errcode='22023';
 end if;
 if p_module_no>1 and not exists (
   select 1 from public.module_progress
   where user_id=v_user and module_no=p_module_no-1
 ) then
   raise exception 'Conclua o módulo anterior primeiro' using errcode='42501';
 end if;
 insert into public.module_progress(user_id,module_no)
 values(v_user,p_module_no) on conflict(user_id,module_no) do nothing;
 return jsonb_build_object('module',p_module_no,'completed',true);
end;
$fn$;
revoke all on function public.complete_natal_module(integer) from public,anon;
grant execute on function public.complete_natal_module(integer) to authenticated;
