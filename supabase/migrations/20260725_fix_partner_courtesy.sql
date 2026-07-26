-- Mantem o banco compativel com os papeis usados pelo aplicativo.
-- O plano Pro e armazenado em `plan`; `role` identifica piloto ou administrador.
alter table public.account_entitlements
  drop constraint if exists account_entitlements_role_check;

alter table public.account_entitlements
  add constraint account_entitlements_role_check
  check (role in ('member', 'pilot', 'admin'));

create or replace function public.grant_partner_courtesy(
  target_email text,
  months integer default 12,
  courtesy_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  target_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem conceder cortesias.';
  end if;
  if months not in (1, 3, 6, 12, 24, 36) then
    raise exception 'Validade invalida.';
  end if;
  select id into target_user_id from auth.users
   where lower(email) = lower(trim(target_email)) limit 1;
  if target_user_id is null then
    raise exception 'Nenhum piloto encontrado com este e-mail.';
  end if;
  insert into public.account_entitlements
    (user_id, plan, role, status, courtesy_expires_at, source, granted_by, updated_at)
  values
    (target_user_id, 'pro', 'pilot', 'active',
     now() + make_interval(months => months),
     coalesce(nullif(trim(courtesy_note), ''), 'partner_courtesy'), auth.uid(), now())
  on conflict (user_id) do update set
    plan = 'pro', status = 'active',
    courtesy_expires_at = excluded.courtesy_expires_at,
    source = excluded.source, granted_by = excluded.granted_by,
    updated_at = now(),
    role = case when public.account_entitlements.role = 'admin' then 'admin' else 'pilot' end;
end;
$function$;

revoke all on function public.grant_partner_courtesy(text, integer, text) from public;
grant execute on function public.grant_partner_courtesy(text, integer, text) to authenticated;
