-- Restrições de plano no banco: ocultar o cadeado no navegador não concede acesso.
create or replace function public.has_active_pro_access(target_user uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.account_entitlements e
    where e.user_id = target_user
      and e.status = 'active'
      and (e.plan = 'pro' or e.role = 'admin')
      and (e.courtesy_expires_at is null or e.courtesy_expires_at > now())
  );
$$;

revoke all on function public.has_active_pro_access(uuid) from public;
grant execute on function public.has_active_pro_access(uuid) to authenticated;

create or replace function public.can_create_user_record(kind text, item_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when kind = 'profile' then true
    when kind = 'aircraft' and public.has_active_pro_access(auth.uid()) then true
    when kind = 'aircraft' then (
      select count(*) = 0
      from public.user_records r
      where r.user_id = auth.uid() and r.collection = 'aircraft' and r.record_id <> item_id
    )
    else public.has_active_pro_access(auth.uid())
  end;
$$;
revoke all on function public.can_create_user_record(text,text) from public;
grant execute on function public.can_create_user_record(text,text) to authenticated;

drop policy if exists "user_records_select_own" on public.user_records;
drop policy if exists "user_records_insert_own" on public.user_records;
drop policy if exists "user_records_update_own" on public.user_records;
drop policy if exists "user_records_delete_own" on public.user_records;

-- Free sincroniza somente perfil e sua aeronave. Dados Pro permanecem protegidos.
create policy "user_records_select_by_plan" on public.user_records
for select to authenticated
using (
  auth.uid() = user_id
  and (collection in ('profile','aircraft') or public.has_active_pro_access(auth.uid()))
);

create policy "user_records_insert_by_plan" on public.user_records
for insert to authenticated
with check (
  auth.uid() = user_id
  and public.can_create_user_record(collection, record_id)
);

create policy "user_records_update_by_plan" on public.user_records
for update to authenticated
using (
  auth.uid() = user_id
  and (collection in ('profile','aircraft') or public.has_active_pro_access(auth.uid()))
)
with check (
  auth.uid() = user_id
  and (collection in ('profile','aircraft') or public.has_active_pro_access(auth.uid()))
);

create policy "user_records_delete_by_plan" on public.user_records
for delete to authenticated
using (
  auth.uid() = user_id
  and (collection in ('profile','aircraft') or public.has_active_pro_access(auth.uid()))
);
