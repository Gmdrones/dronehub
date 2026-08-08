-- Canonical cross-device mission sync through user_records + Postgres Changes.
alter table public.user_records replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and pr.prrelid = 'public.user_records'::regclass
  ) then
    alter publication supabase_realtime add table public.user_records;
  end if;
end $$;

drop policy if exists "Users manage their own records" on public.user_records;
drop policy if exists user_records_select_by_plan on public.user_records;
drop policy if exists user_records_insert_by_plan on public.user_records;
drop policy if exists user_records_update_by_plan on public.user_records;
drop policy if exists user_records_delete_by_plan on public.user_records;

create policy user_records_select_own
on public.user_records for select to authenticated
using ((select auth.uid()) = user_id);

create policy user_records_insert_own
on public.user_records for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (collection in ('profile','aircraft') or public.has_active_pro_access((select auth.uid())))
);

create policy user_records_update_own
on public.user_records for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (collection in ('profile','aircraft') or public.has_active_pro_access((select auth.uid())))
);

create policy user_records_delete_own
on public.user_records for delete to authenticated
using (
  (select auth.uid()) = user_id
  and (collection in ('profile','aircraft') or public.has_active_pro_access((select auth.uid())))
);

create index if not exists user_records_mission_sync_idx
on public.user_records (user_id, updated_at desc)
where collection = 'missions';
