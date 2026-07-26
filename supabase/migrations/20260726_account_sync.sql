create or replace function public.get_my_entitlement()
returns table(plan text, role text, status text, courtesy_expires_at timestamptz)
language sql security definer set search_path = public stable
as $$
  select e.plan, e.role, e.status, e.courtesy_expires_at
  from public.account_entitlements e where e.user_id = auth.uid() limit 1;
$$;
revoke all on function public.get_my_entitlement() from public;
grant execute on function public.get_my_entitlement() to authenticated;

create table if not exists public.user_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  collection text not null,
  record_id text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, record_id)
);
alter table public.user_records enable row level security;
drop policy if exists "user_records_select_own" on public.user_records;
drop policy if exists "user_records_insert_own" on public.user_records;
drop policy if exists "user_records_update_own" on public.user_records;
drop policy if exists "user_records_delete_own" on public.user_records;
create policy "user_records_select_own" on public.user_records for select to authenticated using (auth.uid() = user_id);
create policy "user_records_insert_own" on public.user_records for insert to authenticated with check (auth.uid() = user_id);
create policy "user_records_update_own" on public.user_records for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_records_delete_own" on public.user_records for delete to authenticated using (auth.uid() = user_id);

create or replace function public.touch_user_record()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists user_records_touch on public.user_records;
create trigger user_records_touch before update on public.user_records for each row execute function public.touch_user_record();
