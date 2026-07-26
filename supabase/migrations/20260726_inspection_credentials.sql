create table if not exists public.inspection_credentials (
  token text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked boolean not null default false
);

alter table public.inspection_credentials enable row level security;

drop policy if exists "inspection credentials insert owner" on public.inspection_credentials;
create policy "inspection credentials insert owner"
on public.inspection_credentials for insert to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "inspection credentials update owner" on public.inspection_credentials;
create policy "inspection credentials update owner"
on public.inspection_credentials for update to authenticated
using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "inspection credentials delete owner" on public.inspection_credentials;
create policy "inspection credentials delete owner"
on public.inspection_credentials for delete to authenticated
using (auth.uid() = owner_id);

create or replace function public.get_inspection_credential(p_token text)
returns table(payload jsonb, created_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.payload, c.created_at, c.expires_at
  from public.inspection_credentials c
  where c.token = p_token
    and c.revoked = false
    and c.expires_at > now()
  limit 1;
$$;

revoke all on function public.get_inspection_credential(text) from public;
grant execute on function public.get_inspection_credential(text) to anon, authenticated;
create index if not exists inspection_credentials_owner_idx on public.inspection_credentials(owner_id);
create index if not exists inspection_credentials_expiry_idx on public.inspection_credentials(expires_at);
