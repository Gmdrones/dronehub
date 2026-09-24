-- Restringe a leitura na tabela user_records para que usuários FREE leiam apenas profile e aircraft.
-- Coleções protegidas (missions, documents, transactions, clients, batteries) exigem Pro ativo ou Admin.

drop policy if exists user_records_select_own on public.user_records;
drop policy if exists user_records_select_by_plan on public.user_records;

create policy user_records_select_by_plan
on public.user_records
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (
    collection in ('profile', 'aircraft')
    or public.has_active_pro_access((select auth.uid()))
  )
);
