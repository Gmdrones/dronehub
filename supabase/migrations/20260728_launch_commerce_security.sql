-- Fonte de verdade comercial, telemetria e expiração automática dos acessos.
create table if not exists public.payment_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_payment_id text not null,
  preference_id text,
  status text not null check (status in ('pending','approved','cancelled','refunded','charged_back')),
  status_detail text,
  amount numeric(12,2) not null default 0,
  currency text not null default 'BRL',
  payment_method text,
  payer_email text,
  paid_at timestamptz,
  expires_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_payment_id)
);

create table if not exists public.integration_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  service text not null check (service in ('payment','weather','ai','upload','sync','email','backup')),
  event text not null,
  level text not null check (level in ('info','warning','error')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.payment_transactions enable row level security;
alter table public.integration_events enable row level security;
revoke all on public.payment_transactions, public.integration_events from anon, authenticated;
grant select on public.payment_transactions to authenticated;
drop policy if exists "payments_select_own_or_admin" on public.payment_transactions;
create policy "payments_select_own_or_admin" on public.payment_transactions for select to authenticated
using (user_id=auth.uid() or public.is_admin());
grant select on public.integration_events to authenticated;
drop policy if exists "events_select_admin" on public.integration_events;
create policy "events_select_admin" on public.integration_events for select to authenticated using (public.is_admin());

create or replace function public.apply_payment_entitlement(target_user uuid, payment_status text, access_months integer, payment_reference text)
returns void language plpgsql security definer set search_path=public as $$
declare next_expiry timestamptz;
begin
  if payment_status='approved' then
    select greatest(now(),coalesce(courtesy_expires_at,now()))+make_interval(months=>greatest(1,access_months))
      into next_expiry from public.account_entitlements where user_id=target_user;
    next_expiry:=coalesce(next_expiry,now()+make_interval(months=>greatest(1,access_months)));
    insert into public.account_entitlements(user_id,plan,role,status,courtesy_expires_at,source,updated_at)
      values(target_user,'pro','pilot','active',next_expiry,'mercado_pago:'||payment_reference,now())
    on conflict(user_id) do update set plan='pro',status='active',
      role=case when account_entitlements.role='admin' then 'admin' else 'pilot' end,
      courtesy_expires_at=next_expiry,source='mercado_pago:'||payment_reference,updated_at=now();
  elsif payment_status in ('refunded','charged_back','cancelled') then
    update public.account_entitlements set plan=case when role='admin' then plan else 'free' end,
      status=case when role='admin' then status else 'inactive' end,
      courtesy_expires_at=case when role='admin' then courtesy_expires_at else now() end,
      source='mercado_pago:'||payment_reference,updated_at=now() where user_id=target_user;
  end if;
end $$;
revoke all on function public.apply_payment_entitlement(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.apply_payment_entitlement(uuid,text,integer,text) to service_role;

create or replace function public.get_my_entitlement()
returns table(plan text, role text, status text, courtesy_expires_at timestamptz)
language sql security definer set search_path=public stable as $$
  select case when e.role='admin' then 'pro'
              when e.status='active' and e.plan='pro' and (e.courtesy_expires_at is null or e.courtesy_expires_at>now()) then 'pro'
              else 'free' end,
         case when e.role='admin' and e.status='active' then 'admin' else 'pilot' end,
         case when e.role='admin' and e.status='active' then 'active'
              when e.status='active' and (e.courtesy_expires_at is null or e.courtesy_expires_at>now()) then 'active'
              else 'expired' end,
         e.courtesy_expires_at
  from public.account_entitlements e where e.user_id=auth.uid()
  union all select 'free','pilot','active',null where not exists(select 1 from public.account_entitlements where user_id=auth.uid())
  limit 1;
$$;
revoke all on function public.get_my_entitlement() from public;
grant execute on function public.get_my_entitlement() to authenticated;

create or replace function public.admin_integration_health()
returns table(service text,last_event text,last_level text,last_seen timestamptz,error_count_24h bigint)
language plpgsql security definer set search_path=public stable as $$
begin
 if not public.is_admin() then raise exception 'Acesso administrativo negado.'; end if;
 return query select distinct on (e.service) e.service,e.event,e.level,e.created_at,
   (select count(*) from public.integration_events x where x.service=e.service and x.level='error' and x.created_at>now()-interval '24 hours')
 from public.integration_events e order by e.service,e.created_at desc;
end $$;
revoke all on function public.admin_integration_health() from public;
grant execute on function public.admin_integration_health() to authenticated;

create index if not exists payment_transactions_user_idx on public.payment_transactions(user_id,created_at desc);
create index if not exists integration_events_service_idx on public.integration_events(service,created_at desc);
