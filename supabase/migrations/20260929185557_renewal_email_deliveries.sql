create table public.renewal_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  stage smallint not null check (stage in (7, 3, 1)),
  state text not null default 'claimed' check (state in ('claimed','accepted','failed','uncertain','skipped')),
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (user_id, expires_at, stage)
);
alter table public.renewal_email_deliveries enable row level security;
revoke all on public.renewal_email_deliveries from public, anon, authenticated;
grant select, insert, update on public.renewal_email_deliveries to service_role;
comment on table public.renewal_email_deliveries is 'At most one provider attempt per expiry/stage. Accepted is not inbox delivery. Reconcile claimed/uncertain before retry.';
