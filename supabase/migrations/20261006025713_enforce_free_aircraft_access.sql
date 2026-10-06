-- Preserve the fleet after downgrade; Free can use only the oldest record ID.
-- Timestamp IDs are chronological and cannot be changed to unlock another drone.
begin;

create schema if not exists dronehub_private;
revoke all on schema dronehub_private from public;
grant usage on schema dronehub_private to authenticated;

create or replace function dronehub_private.free_aircraft_id()
returns text
language sql stable security definer
set search_path = ''
as $$
  select r.record_id from public.user_records r
  where r.user_id = (select auth.uid()) and r.collection = 'aircraft'
  order by r.record_id collate "C" limit 1;
$$;
revoke all on function dronehub_private.free_aircraft_id() from public;
grant execute on function dronehub_private.free_aircraft_id() to authenticated;

-- Restrictive policies also constrain any existing permissive owner policies.
drop policy if exists user_records_aircraft_plan_limit on public.user_records;
create policy user_records_aircraft_plan_limit
on public.user_records as restrictive for all to authenticated
using (
  (select auth.uid()) = user_id and (
    collection <> 'aircraft'
    or (select public.has_active_pro_access(auth.uid()))
    or record_id = (select dronehub_private.free_aircraft_id())
  )
)
with check (
  (select auth.uid()) = user_id and (
    collection <> 'aircraft'
    or (select public.has_active_pro_access(auth.uid()))
    or record_id = coalesce((select dronehub_private.free_aircraft_id()), record_id)
  )
);

create or replace function dronehub_private.enforce_aircraft_write()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- Server/admin operations have no pilot JWT; owner checks remain in RLS.
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' and old.collection = 'aircraft' and
    (new.user_id, new.collection, new.record_id) is distinct from
    (old.user_id, old.collection, old.record_id) then
    raise exception 'A identidade da aeronave não pode ser alterada.' using errcode = '42501';
  end if;
  if new.collection <> 'aircraft' or public.has_active_pro_access(auth.uid()) then
    return new;
  end if;
  -- Serialize concurrent registrations from different devices for this pilot.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  if exists (
    select 1 from public.user_records r
    where r.user_id = new.user_id and r.collection = 'aircraft'
  ) and not exists (
    select 1 from public.user_records r
    where r.user_id = new.user_id and r.collection = 'aircraft' and r.record_id = new.record_id
  ) then
    raise exception 'O plano Free permite apenas uma aeronave. Renove o Pro para ampliar sua frota.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function dronehub_private.enforce_aircraft_write() from public;
drop trigger if exists user_records_aircraft_write_limit on public.user_records;
create trigger user_records_aircraft_write_limit
before insert or update on public.user_records
for each row execute function dronehub_private.enforce_aircraft_write();

commit;
