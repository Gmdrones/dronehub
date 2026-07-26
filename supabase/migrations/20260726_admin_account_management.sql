create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  target_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('update','block','unblock','delete')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;

create or replace function public.admin_list_accounts(search_term text default null)
returns table(user_id uuid,email text,full_name text,phone text,city text,plan text,role text,account_status text,courtesy_expires_at timestamptz,created_at timestamptz,last_sign_in_at timestamptz,record_count bigint)
language plpgsql security definer set search_path=public,auth stable as $$
begin
 if not public.is_admin() then raise exception 'Acesso administrativo negado.'; end if;
 return query select u.id,u.email::text,
  coalesce(p.payload->>'name',p.payload->>'fullName',u.raw_user_meta_data->>'full_name',split_part(u.email,'@',1))::text,
  coalesce(p.payload->>'phone',p.payload->>'telefone','')::text,
  coalesce(p.payload->>'city',p.payload->>'cidade','')::text,
  coalesce(e.plan,'free')::text,coalesce(e.role,'pilot')::text,
  case when u.banned_until is not null and u.banned_until>now() then 'blocked' else coalesce(e.status,'active') end::text,
  e.courtesy_expires_at,u.created_at,u.last_sign_in_at,
  (select count(*) from public.user_records r where r.user_id=u.id)
 from auth.users u left join public.account_entitlements e on e.user_id=u.id
 left join lateral (select r.payload from public.user_records r where r.user_id=u.id and r.collection='profile' order by r.updated_at desc limit 1) p on true
 where search_term is null or trim(search_term)='' or u.email ilike '%'||trim(search_term)||'%'
    or coalesce(p.payload->>'name',p.payload->>'fullName',u.raw_user_meta_data->>'full_name','') ilike '%'||trim(search_term)||'%'
 order by u.created_at desc;
end $$;

create or replace function public.admin_update_account(target_user_id uuid,new_full_name text default null,new_phone text default null,new_city text default null,new_plan text default null,new_role text default null,pro_months integer default 12)
returns void language plpgsql security definer set search_path=public,auth as $$
declare profile_payload jsonb; normalized_role text; current_plan text;
begin
 if not public.is_admin() then raise exception 'Acesso administrativo negado.'; end if;
 if not exists(select 1 from auth.users where id=target_user_id) then raise exception 'Conta não encontrada.'; end if;
 if new_plan is not null and new_plan not in ('free','pro') then raise exception 'Plano inválido.'; end if;
 if new_role is not null and new_role not in ('pilot','admin') then raise exception 'Função inválida.'; end if;
 if target_user_id=auth.uid() and new_role is not null and new_role<>'admin' then raise exception 'Você não pode remover sua própria permissão administrativa.'; end if;
 if pro_months not in (1,3,6,12,24,36) then raise exception 'Validade inválida.'; end if;
 update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('full_name',coalesce(nullif(trim(new_full_name),''),raw_user_meta_data->>'full_name')) where id=target_user_id;
 select coalesce(payload,'{}'::jsonb) into profile_payload from public.user_records where user_id=target_user_id and collection='profile' order by updated_at desc limit 1;
 profile_payload:=coalesce(profile_payload,'{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object('name',nullif(trim(new_full_name),''),'phone',nullif(trim(new_phone),''),'city',nullif(trim(new_city),'')));
 insert into public.user_records(user_id,collection,record_id,payload) values(target_user_id,'profile','primary',profile_payload)
 on conflict(user_id,collection,record_id) do update set payload=excluded.payload,updated_at=now();
 select coalesce(e.plan,'free'),coalesce(e.role,'pilot') into current_plan,normalized_role from public.account_entitlements e where e.user_id=target_user_id;
 current_plan:=coalesce(new_plan,current_plan,'free'); normalized_role:=coalesce(new_role,normalized_role,'pilot');
 insert into public.account_entitlements(user_id,plan,role,status,courtesy_expires_at,source,granted_by,updated_at)
 values(target_user_id,current_plan,normalized_role,'active',case when current_plan='pro' then now()+make_interval(months=>pro_months) else null end,'admin_management',auth.uid(),now())
 on conflict(user_id) do update set plan=current_plan,role=normalized_role,status='active',courtesy_expires_at=case when current_plan='pro' then coalesce(public.account_entitlements.courtesy_expires_at,now()+make_interval(months=>pro_months)) else null end,source='admin_management',granted_by=auth.uid(),updated_at=now();
 insert into public.admin_audit_log(actor_id,target_id,action,details) values(auth.uid(),target_user_id,'update',jsonb_build_object('plan',new_plan,'role',new_role));
end $$;

create or replace function public.admin_set_account_blocked(target_user_id uuid,should_block boolean)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
 if not public.is_admin() then raise exception 'Acesso administrativo negado.'; end if;
 if target_user_id=auth.uid() then raise exception 'Você não pode bloquear sua própria conta.'; end if;
 update auth.users set banned_until=case when should_block then now()+interval '100 years' else null end where id=target_user_id;
 if not found then raise exception 'Conta não encontrada.'; end if;
 update public.account_entitlements set status=case when should_block then 'blocked' else 'active' end,updated_at=now() where user_id=target_user_id;
 insert into public.admin_audit_log(actor_id,target_id,action) values(auth.uid(),target_user_id,case when should_block then 'block' else 'unblock' end);
end $$;

create or replace function public.admin_delete_account(target_user_id uuid)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
 if not public.is_admin() then raise exception 'Acesso administrativo negado.'; end if;
 if target_user_id=auth.uid() then raise exception 'Você não pode excluir sua própria conta.'; end if;
 if exists(select 1 from public.account_entitlements where user_id=target_user_id and role='admin') and (select count(*) from public.account_entitlements where role='admin' and status='active')<=1 then raise exception 'O último administrador não pode ser excluído.'; end if;
 insert into public.admin_audit_log(actor_id,target_id,action) values(auth.uid(),target_user_id,'delete');
 delete from auth.users where id=target_user_id;
 if not found then raise exception 'Conta não encontrada.'; end if;
end $$;

revoke all on function public.admin_list_accounts(text) from public;
revoke all on function public.admin_update_account(uuid,text,text,text,text,text,integer) from public;
revoke all on function public.admin_set_account_blocked(uuid,boolean) from public;
revoke all on function public.admin_delete_account(uuid) from public;
grant execute on function public.admin_list_accounts(text) to authenticated;
grant execute on function public.admin_update_account(uuid,text,text,text,text,text,integer) to authenticated;
grant execute on function public.admin_set_account_blocked(uuid,boolean) to authenticated;
grant execute on function public.admin_delete_account(uuid) to authenticated;
