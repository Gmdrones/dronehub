create extension if not exists pg_cron with schema pg_catalog;

update public.account_entitlements
set plan='free', status='active', courtesy_expires_at=null,
    source=case when source like '%:expired' then source else source||':expired' end,
    updated_at=now()
where plan='pro' and courtesy_expires_at<=now();

select cron.schedule(
  'dronehub-downgrade-expired-pro', '*/5 * * * *',
  $job$
    update public.account_entitlements
    set plan='free', status='active', courtesy_expires_at=null,
        source=case when source like '%:expired' then source else source||':expired' end,
        updated_at=now()
    where plan='pro' and courtesy_expires_at<=now();
  $job$
);
