do $fix$
declare definition text;
begin
 select pg_get_functiondef('public.admin_update_account(uuid,text,text,text,text,text,integer)'::regprocedure) into definition;
 if position('normalized_role:=coalesce(new_role,normalized_role,''pilot'');' in definition)=0 then
   raise exception 'Unexpected function definition; refusing to overwrite';
 end if;
 definition:=replace(definition, 'new_role not in (''pilot'',''admin'')', 'new_role not in (''pilot'',''member'',''admin'')');
 definition:=replace(definition, 'normalized_role:=coalesce(new_role,normalized_role,''pilot'');', 'normalized_role:=coalesce(new_role,normalized_role,''member''); if normalized_role=''pilot'' then normalized_role:=''member''; end if;');
 execute definition;
end $fix$;
